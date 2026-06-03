package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// dirCustomization holds metadata parsed from a directory customization file
// (.directory, desktop.ini, or .DS_Store).
type dirCustomization struct {
	Source  string `json:"source"`            // ".directory", "desktop.ini", ".DS_Store"
	Name    string `json:"name,omitempty"`    // custom display name
	Icon    string `json:"icon,omitempty"`    // icon path or theme name (e.g. "folder-violet")
	Comment string `json:"comment,omitempty"` // tooltip or description
}

// readDirCustomization looks for a customization file inside dirPath and returns
// parsed metadata. Returns nil if none is found.
//
// This is an internal server read — it intentionally bypasses the blacklist.
// The blacklist controls which entries appear in API listing responses; it does
// not restrict what the server reads for its own computation (e.g. enriching a
// parent directory's metadata with its custom icon or display name).
func readDirCustomization(dirPath string) *dirCustomization {
	// .directory — KDE/Dolphin (freedesktop.org Desktop Entry spec)
	if data, err := os.ReadFile(filepath.Join(dirPath, ".directory")); err == nil {
		return parseDotDirectory(data)
	}
	// desktop.ini — Windows shell folder customization
	if data, err := os.ReadFile(filepath.Join(dirPath, "desktop.ini")); err == nil {
		if c := parseDesktopIni(data); c != nil {
			return c
		}
	}
	// .DS_Store — macOS (binary format; presence is all we detect)
	if _, err := os.Stat(filepath.Join(dirPath, ".DS_Store")); err == nil {
		return &dirCustomization{Source: ".DS_Store"}
	}
	return nil
}

// parseINI parses INI-style content into section → key → value.
// - BOM is stripped automatically.
// - Comment lines starting with ; or # are skipped.
// - For duplicate keys within a section, the first occurrence wins.
// - Localized keys (e.g. "Name[nl]") are stored verbatim.
func parseINI(data []byte) map[string]map[string]string {
	out := make(map[string]map[string]string)
	section := ""
	// Strip UTF-8 BOM (common in Windows-generated INI files)
	data = bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			section = line[1 : len(line)-1]
			if out[section] == nil {
				out[section] = make(map[string]string)
			}
			continue
		}
		if i := strings.IndexByte(line, '='); i >= 0 {
			key := strings.TrimSpace(line[:i])
			val := strings.TrimSpace(line[i+1:])
			if out[section] == nil {
				out[section] = make(map[string]string)
			}
			if _, exists := out[section][key]; !exists {
				out[section][key] = val
			}
		}
	}
	return out
}

func parseDotDirectory(data []byte) *dirCustomization {
	sections := parseINI(data)
	c := &dirCustomization{Source: ".directory"}
	if entry := sections["Desktop Entry"]; entry != nil {
		c.Name = entry["Name"]
		c.Icon = entry["Icon"]
		c.Comment = entry["Comment"]
	}
	return c
}

func parseDesktopIni(data []byte) *dirCustomization {
	sections := parseINI(data)
	// Windows folder customization lives in [.ShellClassInfo].
	// Generic desktop.ini files (config, readme markers, etc.) that lack this
	// section are not directory customizations and should be ignored.
	shell := sections[".ShellClassInfo"]
	if shell == nil {
		return nil
	}
	c := &dirCustomization{Source: "desktop.ini"}
	// IconResource ("path,index") takes priority over IconFile
	if v := shell["IconResource"]; v != "" {
		c.Icon = v
	} else {
		c.Icon = shell["IconFile"]
	}
	c.Comment = shell["InfoTip"]
	return c
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

// handleFsCustomizationGet returns the parsed customization for a single directory.
//
//	GET /_api/v2/fs/customization?path=<dir>
func handleFsCustomizationGet(w http.ResponseWriter, r *http.Request) {
	dirPath := r.URL.Query().Get("path")
	if dirPath == "" {
		jsonErr(w, http.StatusBadRequest, "path required")
		return
	}
	c := readDirCustomization(dirPath)
	jsonOK(w, map[string]any{"customization": c})
}

// handleFsCustomizationPut writes or updates the .directory file for a directory.
// Fields set to null in the JSON body are left unchanged; fields set to "" are cleared.
//
//	PUT /_api/v2/fs/customization?path=<dir>
//	Body: { "name": "...", "icon": "...", "comment": "..." }
func handleFsCustomizationPut(w http.ResponseWriter, r *http.Request) {
	dirPath := r.URL.Query().Get("path")
	if dirPath == "" {
		jsonErr(w, http.StatusBadRequest, "path required")
		return
	}
	info, err := os.Stat(dirPath)
	if err != nil || !info.IsDir() {
		jsonErr(w, http.StatusBadRequest, "path is not a directory")
		return
	}

	// Use pointer fields so we can distinguish "omitted" (nil = keep) from
	// "explicitly set to empty string" (ptr to "" = clear the field).
	var body struct {
		Name    *string `json:"name"`
		Icon    *string `json:"icon"`
		Comment *string `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	// Read existing values to preserve fields not included in this request.
	existing := &dirCustomization{}
	dotDir := filepath.Join(dirPath, ".directory")
	if data, err := os.ReadFile(dotDir); err == nil {
		existing = parseDotDirectory(data)
	}

	finalName := existing.Name
	if body.Name != nil {
		finalName = *body.Name
	}
	finalIcon := existing.Icon
	if body.Icon != nil {
		finalIcon = *body.Icon
	}
	finalComment := existing.Comment
	if body.Comment != nil {
		finalComment = *body.Comment
	}

	content := formatDotDirectory(finalName, finalIcon, finalComment)
	if err := os.WriteFile(dotDir, []byte(content), 0644); err != nil {
		jsonErr(w, http.StatusInternalServerError, "write failed: "+err.Error())
		return
	}

	c := &dirCustomization{
		Source:  ".directory",
		Name:    finalName,
		Icon:    finalIcon,
		Comment: finalComment,
	}
	jsonOK(w, map[string]any{"ok": true, "customization": c})
}

// formatDotDirectory serialises name/icon/comment into a freedesktop.org
// [Desktop Entry] .directory file. Empty fields are omitted.
func formatDotDirectory(name, icon, comment string) string {
	var sb strings.Builder
	sb.WriteString("[Desktop Entry]\n")
	sb.WriteString("Type=Directory\n")
	sb.WriteString("Encoding=UTF-8\n")
	if name != "" {
		sb.WriteString("Name=" + name + "\n")
	}
	if comment != "" {
		sb.WriteString("Comment=" + comment + "\n")
	}
	if icon != "" {
		sb.WriteString("Icon=" + icon + "\n")
	}
	sb.WriteString("\n")
	return sb.String()
}
