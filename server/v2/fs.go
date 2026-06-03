package main

import (
	"encoding/base64"
	"encoding/json"
	"mime"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

func handleFsStat(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		jsonErr(w, http.StatusBadRequest, "path required")
		return
	}
	if isExcluded(path, nil) {
		jsonErr(w, http.StatusForbidden, "Path is blacklisted")
		return
	}
	info, err := os.Stat(path)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "Not found: "+path)
		return
	}
	kind := "file"
	var size *int64
	if info.IsDir() {
		kind = "dir"
	} else {
		s := info.Size()
		size = &s
	}
	mtime := info.ModTime().Format("2006-01-02T15:04:05")
	jsonOK(w, map[string]any{
		"name":  info.Name(),
		"path":  path,
		"kind":  kind,
		"size":  size,
		"mtime": mtime,
	})
}

func handleFsListDir(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	path := q.Get("path")
	if path == "" {
		jsonErr(w, http.StatusBadRequest, "path required")
		return
	}
	if isExcluded(path, nil) {
		jsonErr(w, http.StatusForbidden, "Path is blacklisted")
		return
	}
	info, err := os.Stat(path)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "Not found: "+path)
		return
	}
	if !info.IsDir() {
		jsonErr(w, http.StatusBadRequest, "Not a directory")
		return
	}

	showHidden := qBool(q, "showHidden", true)
	includeMetadata := qBool(q, "includeMetadata", true)
	includeDirSize := qBool(q, "includeDirSize", false)
	excludeVals, hasExclude := q["excludeCategories"]
	excluded := parseExcludeParam(strings.Join(excludeVals, ","), hasExclude)
	offset, _ := strconv.Atoi(q.Get("offset"))
	limit, _ := strconv.Atoi(q.Get("limit"))

	items := simpleListDir(path, excluded, includeMetadata, showHidden)
	total := len(items)

	start := offset
	if start > total {
		start = total
	}
	var page []any
	if limit > 0 {
		end := start + limit
		if end > total {
			end = total
		}
		page = items[start:end]
	} else {
		page = items[start:]
	}

	// Compute directory sizes concurrently for the current page only.
	// Scoping to the page means at most PAGE_SIZE walks per request.
	if includeDirSize {
		const maxConcurrent = 8
		sem := make(chan struct{}, maxConcurrent)
		var wg sync.WaitGroup
		for _, raw := range page {
			m := raw.(map[string]any)
			if m["kind"] != "dir" {
				continue
			}
			p := m["path"].(string)
			wg.Add(1)
			go func(item map[string]any, dirPath string) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()
				var total int64
				filepath.Walk(dirPath, func(_ string, info os.FileInfo, err error) error {
					if err == nil && !info.IsDir() {
						total += info.Size()
					}
					return nil
				})
				item["size"] = total
			}(m, p)
		}
		wg.Wait()
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Expires", "0")
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	enc.Encode(map[string]any{"items": page, "total": total, "offset": offset})
}

func simpleListDir(dirPath string, excluded []string, includeMetadata, showHidden bool) []any {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil
	}
	items := make([]any, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		hidden := strings.HasPrefix(name, ".")
		if !showHidden && hidden {
			continue
		}
		entryPath := filepath.Join(dirPath, name)
		if isExcluded(entryPath, excluded) {
			continue
		}

		eType := e.Type()
		kind := "other"
		if e.IsDir() {
			kind = "dir"
		} else if eType.IsRegular() || eType&os.ModeSymlink != 0 {
			kind = "file"
		} else {
			continue
		}

		var size *int64
		var mtime *string
		if includeMetadata {
			if info, err := e.Info(); err == nil {
				if kind == "file" {
					s := info.Size()
					size = &s
				}
				m := info.ModTime().Format("2006-01-02T15:04:05")
				mtime = &m
			}
		}

		icon := activeIconTheme.resolve(name, kind == "dir")
		var iconField, iconOpenField any
		if icon != "" {
			iconField = icon
		}
		var customization *dirCustomization
		if kind == "dir" {
			if open := activeIconTheme.resolveOpen(name); open != "" {
				iconOpenField = open
			}
			customization = readDirCustomization(entryPath)
		}
		items = append(items, map[string]any{
			"name":          name,
			"path":          entryPath,
			"kind":          kind,
			"size":          size,
			"mtime":         mtime,
			"hidden":        hidden,
			"icon":          iconField,
			"icon_open":     iconOpenField,
			"customization": customization,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		a := items[i].(map[string]any)
		b := items[j].(map[string]any)
		aIsDir := a["kind"] == "dir"
		bIsDir := b["kind"] == "dir"
		if aIsDir != bIsDir {
			return aIsDir
		}
		return strings.ToLower(a["name"].(string)) < strings.ToLower(b["name"].(string))
	})
	return items
}

func handleFsDirSize(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		jsonErr(w, http.StatusBadRequest, "path required")
		return
	}
	if isExcluded(path, nil) {
		jsonErr(w, http.StatusForbidden, "Path is blacklisted")
		return
	}
	var total int64
	filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			total += info.Size()
		}
		return nil
	})
	jsonOK(w, map[string]any{"size": total})
}

func handleFsPreview(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	path := q.Get("path")
	if path == "" {
		jsonErr(w, http.StatusBadRequest, "path required")
		return
	}
	if isExcluded(path, nil) {
		jsonErr(w, http.StatusForbidden, "Path is blacklisted")
		return
	}
	force := qBool(q, "force", false)

	info, err := os.Stat(path)
	if err != nil {
		jsonErr(w, http.StatusNotFound, "Not found: "+path)
		return
	}
	if info.IsDir() {
		jsonOK(w, map[string]any{"kind": "dir"})
		return
	}

	maxBytes := loadMaxPreviewBytes()
	fileSize := info.Size()
	mimeType := guessMIME(path)

	if !force && fileSize > int64(maxBytes) {
		if !strings.HasPrefix(mimeType, "image/") && !strings.HasPrefix(mimeType, "video/") && !strings.HasPrefix(mimeType, "audio/") {
			jsonOK(w, map[string]any{"kind": "tooLarge", "fileSize": fileSize, "maxBytes": maxBytes})
			return
		}
	}

	readMax := maxBytes
	if force {
		readMax = int(fileSize) + 1
	}

	data, err := readFileBytes(path, readMax)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	if strings.HasPrefix(mimeType, "image/") {
		b64 := base64.StdEncoding.EncodeToString(data)
		jsonOK(w, map[string]any{"kind": "image", "mime": mimeType, "dataUrl": "data:" + mimeType + ";base64," + b64})
		return
	}

	if utf8.Valid(data) && !hasBinaryBytes(data) {
		jsonOK(w, map[string]any{"kind": "text", "language": languageForPath(path), "text": string(data)})
	} else {
		jsonOK(w, map[string]any{"kind": "binary", "bytes": fileSize, "mime": mimeType})
	}
}

func handleFsOpenWithSystem(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
		jsonErr(w, http.StatusBadRequest, "path required")
		return
	}
	if isExcluded(body.Path, nil) {
		jsonErr(w, http.StatusForbidden, "Path is blacklisted")
		return
	}
	if _, err := os.Stat(body.Path); err != nil {
		jsonErr(w, http.StatusNotFound, "Not found: "+body.Path)
		return
	}
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", body.Path)
	case "darwin":
		cmd = exec.Command("open", body.Path)
	default:
		cmd = exec.Command("xdg-open", body.Path)
	}
	if err := cmd.Start(); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonOK(w, map[string]string{"path": body.Path})
}

func handleFsCreateFile(w http.ResponseWriter, r *http.Request) {
	var body struct{ Path string `json:"path"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
		jsonErr(w, http.StatusBadRequest, "path required")
		return
	}
	if isExcluded(body.Path, nil) {
		jsonErr(w, http.StatusForbidden, "Path is blacklisted")
		return
	}
	if _, err := os.Stat(body.Path); err == nil {
		jsonErr(w, http.StatusConflict, "Already exists")
		return
	}
	if err := os.MkdirAll(filepath.Dir(body.Path), 0755); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	f, err := os.Create(body.Path)
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	f.Close()
	jsonOK(w, map[string]string{"path": body.Path})
}

func handleFsCreateDir(w http.ResponseWriter, r *http.Request) {
	var body struct{ Path string `json:"path"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
		jsonErr(w, http.StatusBadRequest, "path required")
		return
	}
	if isExcluded(body.Path, nil) {
		jsonErr(w, http.StatusForbidden, "Path is blacklisted")
		return
	}
	if _, err := os.Stat(body.Path); err == nil {
		jsonErr(w, http.StatusConflict, "Already exists")
		return
	}
	if err := os.MkdirAll(body.Path, 0755); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonOK(w, map[string]string{"path": body.Path})
}

func handleFsWriteFile(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Path == "" {
		jsonErr(w, http.StatusBadRequest, "path required")
		return
	}
	if isExcluded(body.Path, nil) {
		jsonErr(w, http.StatusForbidden, "Path is blacklisted")
		return
	}
	if err := os.MkdirAll(filepath.Dir(body.Path), 0755); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := os.WriteFile(body.Path, []byte(body.Content), 0644); err != nil {
		jsonErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	jsonOK(w, map[string]string{"path": body.Path})
}

// ── utilities ─────────────────────────────────────────────────────────────────

func qBool(q url.Values, key string, def bool) bool {
	v := q.Get(key)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

func guessMIME(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	t := mime.TypeByExtension(ext)
	if t == "" {
		return "application/octet-stream"
	}
	if i := strings.Index(t, ";"); i >= 0 {
		t = strings.TrimSpace(t[:i])
	}
	return t
}

func readFileBytes(path string, maxBytes int) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	buf := make([]byte, maxBytes)
	n, _ := f.Read(buf)
	return buf[:n], nil
}

func hasBinaryBytes(data []byte) bool {
	check := data
	if len(check) > 512 {
		check = check[:512]
	}
	for _, b := range check {
		if b == 0 {
			return true
		}
	}
	return false
}

func languageForPath(path string) string {
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(path), "."))
	m := map[string]string{
		"js": "javascript", "mjs": "javascript", "cjs": "javascript",
		"ts": "typescript", "tsx": "typescript",
		"py": "python", "json": "json", "md": "markdown",
		"html": "html", "htm": "html", "css": "css",
		"rs": "rust", "cpp": "cpp", "cc": "cpp", "cxx": "cpp", "h": "cpp", "hpp": "cpp",
		"vue": "html", "yaml": "yaml", "yml": "yaml", "sh": "shell", "go": "go",
	}
	if lang, ok := m[ext]; ok {
		return lang
	}
	return "plaintext"
}

func loadMaxPreviewBytes() int {
	prefsDir := filepath.Join(repoRoot, "config", "preferences")
	defaults := loadJSONFile(filepath.Join(prefsDir, "default-preferences.json"))
	user := loadJSONFile(filepath.Join(prefsDir, "user-preferences.json"))
	if v := nestedInt(user, "preview", "maxPreviewBytes"); v > 0 {
		return v
	}
	if v := nestedInt(defaults, "preview", "maxPreviewBytes"); v > 0 {
		return v
	}
	return 10000
}

func loadJSONFile(path string) map[string]any {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var m map[string]any
	json.Unmarshal(data, &m)
	return m
}

func nestedInt(m map[string]any, keys ...string) int {
	cur := m
	for i, k := range keys {
		if cur == nil {
			return 0
		}
		v := cur[k]
		if i == len(keys)-1 {
			switch n := v.(type) {
			case float64:
				return int(n)
			case int:
				return n
			}
			return 0
		}
		next, ok := v.(map[string]any)
		if !ok {
			return 0
		}
		cur = next
	}
	return 0
}

// isoTime formats a time as ISO 8601 without timezone (matches Python's isoformat(timespec="seconds")).
func isoTime(t time.Time) string {
	return t.Format("2006-01-02T15:04:05")
}
