package main

import (
	"bufio"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"syscall"
)

// explorerItem mirrors the Python make_item_info / _entry_to_item shape.
type explorerItem struct {
	Name          string             `json:"name"`
	Path          string             `json:"path"`
	Type          string             `json:"type"`
	Hidden        bool               `json:"hidden"`
	Icon          *string            `json:"icon"`
	IconOpen      *string            `json:"icon_open"`
	Customization *dirCustomization  `json:"customization,omitempty"`
	URI           *string            `json:"uri"`
	Size          *int64             `json:"size"`
	DateCreated   *float64           `json:"date_created"`
	DateModified  *float64           `json:"date_modified"`
	DateAccessed  *float64           `json:"date_accessed"`
}

func handleExplorerCategories(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]any{
		"categories": getAllBlacklistCategories(),
		"rules":      getAllBlacklistRules(),
	})
}

func handleExplorerRoot(w http.ResponseWriter, r *http.Request) {
	if runtime.GOOS == "windows" {
		jsonErr(w, http.StatusNotFound, "Not available on Windows")
		return
	}
	q := r.URL.Query()
	showHidden := qBool(q, "showHidden", true)
	showFiles := qBool(q, "showFiles", true)
	includeMetadata := qBool(q, "includeMetadata", false)
	excludeVals, hasExclude := q["excludeCategories"]
	excluded := parseExcludeParam(strings.Join(excludeVals, ","), hasExclude)

	path := "/"
	items := explorerListDir(path, excluded, showHidden, includeMetadata, showFiles)
	root := makeRootItem(path, "Root", "root")
	jsonOK(w, map[string]any{"root": root, "items": items})
}

func handleExplorerHome(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	showHidden := qBool(q, "showHidden", true)
	showFiles := qBool(q, "showFiles", true)
	includeMetadata := qBool(q, "includeMetadata", false)
	excludeVals, hasExclude := q["excludeCategories"]
	excluded := parseExcludeParam(strings.Join(excludeVals, ","), hasExclude)

	home, _ := os.UserHomeDir()
	items := explorerListDir(home, excluded, showHidden, includeMetadata, showFiles)
	root := makeItemInfo(home, "", "Home")
	jsonOK(w, map[string]any{"root": root, "items": items})
}

func handleExplorerDrives(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	showHidden := qBool(q, "showHidden", true)
	showFiles := qBool(q, "showFiles", true)
	excludeVals, hasExclude := q["excludeCategories"]
	excluded := parseExcludeParam(strings.Join(excludeVals, ","), hasExclude)

	switch runtime.GOOS {
	case "windows":
		// Windows: enumerate drive letters
		drives := windowsDrives(showHidden)
		root := explorerItem{Name: "Drives", Type: "drive", Hidden: false}
		jsonOK(w, map[string]any{"root": root, "items": drives})
	case "darwin":
		mounts := "/Volumes"
		if _, err := os.Stat(mounts); err != nil {
			root := makeItemInfo("/", "drive", "Volumes")
			jsonOK(w, map[string]any{"root": root, "items": []any{}})
			return
		}
		items := explorerListDir(mounts, excluded, showHidden, true, showFiles)
		root := makeItemInfo(mounts, "drive", "Volumes")
		jsonOK(w, map[string]any{"root": root, "items": items})
	default:
		// Linux: read /proc/mounts
		drives := linuxDrives(excluded)
		root := makeItemInfo("/mnt", "drive", "Drives")
		jsonOK(w, map[string]any{"root": root, "items": drives})
	}
}

func handleExplorer(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	path := q.Get("root")
	if path == "" {
		if runtime.GOOS == "windows" {
			jsonErr(w, http.StatusBadRequest, "root is required on Windows")
			return
		}
		path = "/"
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
		jsonErr(w, http.StatusBadRequest, "Not a directory: "+path)
		return
	}

	showHidden := qBool(q, "showHidden", true)
	showFiles := qBool(q, "showFiles", true)
	includeMetadata := qBool(q, "includeMetadata", true)
	excludeVals, hasExclude := q["excludeCategories"]
	excluded := parseExcludeParam(strings.Join(excludeVals, ","), hasExclude)

	items := explorerListDir(path, excluded, showHidden, includeMetadata, showFiles)
	root := makeItemInfo(path, "", "")
	jsonOK(w, map[string]any{"root": root, "items": items})
}

// ── listing ───────────────────────────────────────────────────────────────────

func explorerListDir(dirPath string, excluded []string, showHidden, includeMetadata, showFiles bool) []explorerItem {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil
	}
	items := make([]explorerItem, 0, len(entries))
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
		var itemType string
		var symlinkTargetIsDir bool
		if eType&os.ModeSymlink != 0 {
			itemType = "symlink"
			// Stat the target so we can distinguish dir-symlinks from file-symlinks.
			if info, err := os.Stat(entryPath); err == nil {
				symlinkTargetIsDir = info.IsDir()
			}
		} else if e.IsDir() {
			itemType = "directory"
		} else if eType.IsRegular() {
			ext := strings.ToLower(filepath.Ext(name))
			if ext == ".lnk" {
				itemType = "shortcut"
			} else {
				mimeType := mime.TypeByExtension(ext)
				if mimeType == "" {
					mimeType = "application/octet-stream"
				} else if i := strings.Index(mimeType, ";"); i >= 0 {
					mimeType = strings.TrimSpace(mimeType[:i])
				}
				itemType = mimeType
			}
		} else {
			continue
		}

		// In tree mode (showFiles=false) keep only directories, directory-symlinks, and shortcuts.
		// File-symlinks are excluded the same as regular files.
		if !showFiles {
			isTreeDir := itemType == "directory" ||
				(itemType == "symlink" && symlinkTargetIsDir) ||
				itemType == "shortcut"
			if !isTreeDir {
				continue
			}
		}

		isDir := itemType == "directory" || (itemType == "symlink" && symlinkTargetIsDir)
		icon := activeIconTheme.resolve(name, isDir)
		var iconPtr, iconOpenPtr *string
		if icon != "" {
			iconPtr = &icon
		}
		var customization *dirCustomization
		if isDir {
			if open := activeIconTheme.resolveOpen(name); open != "" {
				iconOpenPtr = &open
			}
			customization = readDirCustomization(entryPath)
		}
		item := explorerItem{
			Name:          name,
			Path:          entryPath,
			Type:          itemType,
			Hidden:        hidden,
			Icon:          iconPtr,
			IconOpen:      iconOpenPtr,
			Customization: customization,
		}

		if includeMetadata {
			if info, err := e.Info(); err == nil {
				fillTimestamps(&item, info)
				if eType.IsRegular() {
					s := info.Size()
					item.Size = &s
				}
			}
		}

		items = append(items, item)
	}

	sort.Slice(items, func(i, j int) bool {
		a, b := items[i], items[j]
		aDir := a.Type == "directory" || a.Type == "drive" || a.Type == "root"
		bDir := b.Type == "directory" || b.Type == "drive" || b.Type == "root"
		if aDir != bDir {
			return aDir
		}
		return strings.ToLower(a.Name) < strings.ToLower(b.Name)
	})
	return items
}

func makeItemInfo(path, forceType, nameOverride string) explorerItem {
	info, err := os.Stat(path)
	name := nameOverride
	if name == "" && err == nil {
		name = info.Name()
		if name == "" {
			name = path
		}
	}
	itype := forceType
	if itype == "" && err == nil {
		if info.IsDir() {
			itype = "directory"
		} else {
			itype = "file"
		}
	}
	item := explorerItem{
		Name:   name,
		Path:   path,
		Type:   itype,
		Hidden: strings.HasPrefix(filepath.Base(path), "."),
	}
	if err == nil {
		fillTimestamps(&item, info)
		if info.Mode().IsRegular() {
			s := info.Size()
			item.Size = &s
		}
	}
	if item.Type == "directory" {
		item.Customization = readDirCustomization(path)
	}
	return item
}

func makeRootItem(path, name, itype string) explorerItem {
	return explorerItem{Name: name, Path: path, Type: itype, Hidden: false}
}

func fillTimestamps(item *explorerItem, info os.FileInfo) {
	if sys, ok := info.Sys().(*syscall.Stat_t); ok {
		created := float64(sys.Ctim.Sec) + float64(sys.Ctim.Nsec)/1e9
		modified := float64(sys.Mtim.Sec) + float64(sys.Mtim.Nsec)/1e9
		accessed := float64(sys.Atim.Sec) + float64(sys.Atim.Nsec)/1e9
		item.DateCreated = &created
		item.DateModified = &modified
		item.DateAccessed = &accessed
	} else {
		m := float64(info.ModTime().UnixNano()) / 1e9
		item.DateModified = &m
	}
}

// ── drives ────────────────────────────────────────────────────────────────────

var linuxSystemFSTypes = map[string]bool{
	"proc": true, "sysfs": true, "devtmpfs": true, "devpts": true, "tmpfs": true,
	"securityfs": true, "cgroup": true, "cgroup2": true, "pstore": true, "bpf": true,
	"autofs": true, "mqueue": true, "hugetlbfs": true, "debugfs": true, "tracefs": true,
	"fusectl": true, "configfs": true, "ramfs": true, "efivarfs": true,
	"fuse.gvfsd-fuse": true, "rpc_pipefs": true, "nfsd": true, "overlay": true,
	"nsfs": true, "squashfs": true, "swap": true, "fuse": true,
}

var linuxSystemPrefixes = []string{
	"/proc", "/sys", "/dev", "/run/user", "/run/lock",
	"/snap", "/var/lib/docker", "/tmp", "/run/snapd", "/boot",
}

func linuxDrives(excluded []string) []explorerItem {
	f, err := os.Open("/proc/mounts")
	if err != nil {
		return nil
	}
	defer f.Close()

	seen := map[string]bool{}
	var items []explorerItem
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		if len(parts) < 3 {
			continue
		}
		fstype := parts[2]
		mountpoint := strings.ReplaceAll(parts[1], `\040`, " ")
		if linuxSystemFSTypes[fstype] || mountpoint == "/" || seen[mountpoint] {
			continue
		}
		skip := false
		for _, pfx := range linuxSystemPrefixes {
			if strings.HasPrefix(mountpoint, pfx) {
				skip = true
				break
			}
		}
		if skip {
			continue
		}
		p := mountpoint
		if isExcluded(p, excluded) {
			continue
		}
		if info, err := os.Stat(p); err == nil && info.IsDir() {
			seen[mountpoint] = true
			item := makeItemInfo(p, "drive", "")
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})
	return items
}

func windowsDrives(showHidden bool) []explorerItem {
	// Basic Windows drive enumeration without ctypes
	var items []explorerItem
	for c := 'A'; c <= 'Z'; c++ {
		drive := string(c) + ":\\"
		if info, err := os.Stat(drive); err == nil && info.IsDir() {
			item := makeItemInfo(drive, "drive", string(c)+":")
			if showHidden || !item.Hidden {
				items = append(items, item)
			}
		}
	}
	return items
}
