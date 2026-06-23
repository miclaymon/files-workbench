package main

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// ── Source control (git) ──────────────────────────────────────────────────────
//
// The backend the Workbench's SCM broker (client/lib/scm-api.js) forwards plugin
// requests to. Plugins never reach git directly — the Workbench API gates these
// behind the scm:read / scm:write permissions, then calls here:
//
//   POST {data}/scm/detect    { paths } → [{ id, name, root }]
//   GET  {data}/scm/info?root=…         → { branch, ahead, behind, staged, changes, log }
//   POST {control}/scm/commit { root, message } → { ok }
//   POST {control}/scm/init   { path }          → { ok, root }
//
// Everything shells out to the `git` CLI; if git is missing the read endpoints
// report 503 and the client falls back to its mock data.

type scmRepo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Root string `json:"root"`
}

type scmFile struct {
	Path   string `json:"path"`
	Status string `json:"status"`
}

type scmCommit struct {
	Hash    string   `json:"hash"`
	Subject string   `json:"subject"`
	Author  string   `json:"author"`
	Date    string   `json:"date"`
	Refs    []string `json:"refs"`
}

type scmInfo struct {
	Branch  string      `json:"branch"`
	Ahead   int         `json:"ahead"`
	Behind  int         `json:"behind"`
	Staged  []scmFile   `json:"staged"`
	Changes []scmFile   `json:"changes"`
	Log     []scmCommit `json:"log"`
}

func gitAvailable() bool {
	_, err := exec.LookPath("git")
	return err == nil
}

// runGit runs `git -C dir <args>` and returns trimmed stdout.
func runGit(dir string, args ...string) (string, error) {
	full := append([]string{"-C", dir}, args...)
	out, err := exec.Command("git", full...).Output()
	return strings.TrimRight(string(out), "\n"), err
}

// isGitRepo reports whether dir is the root of a git repo (.git may be a dir or,
// for worktrees/submodules, a file).
func isGitRepo(dir string) bool {
	info, err := os.Stat(filepath.Join(dir, ".git"))
	return err == nil && info != nil
}

func addChildRepos(dir string, found map[string]bool) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() {
			child := filepath.Join(dir, e.Name())
			if isGitRepo(child) {
				found[child] = true
			}
		}
	}
}

// detectReposForPath finds repos related to one open path: any ancestor that is a
// repo, the path's direct children that are repos, and the direct siblings of the
// path and of each ancestor. Ancestor depth is capped so the scan stays bounded.
func detectReposForPath(path string, found map[string]bool) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return
	}
	dir := abs
	for depth := 0; depth < 24; depth++ {
		if isGitRepo(dir) {
			found[dir] = true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break // filesystem root
		}
		addChildRepos(parent, found) // siblings of dir (direct + ancestor siblings)
		dir = parent
	}
	addChildRepos(abs, found) // direct children of the path
}

func handleScmDetect(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Paths []string `json:"paths"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if !gitAvailable() {
		jsonErr(w, http.StatusServiceUnavailable, "git not available")
		return
	}
	found := map[string]bool{}
	for _, p := range body.Paths {
		if p != "" {
			detectReposForPath(p, found)
		}
	}
	repos := make([]scmRepo, 0, len(found))
	for root := range found {
		repos = append(repos, scmRepo{ID: root, Name: filepath.Base(root), Root: root})
	}
	sort.Slice(repos, func(i, j int) bool { return repos[i].Root < repos[j].Root })
	jsonOK(w, repos)
}

func handleScmInfo(w http.ResponseWriter, r *http.Request) {
	root := r.URL.Query().Get("root")
	if root == "" {
		jsonErr(w, http.StatusBadRequest, "root required")
		return
	}
	if !gitAvailable() {
		jsonErr(w, http.StatusServiceUnavailable, "git not available")
		return
	}
	if !isGitRepo(root) {
		jsonErr(w, http.StatusNotFound, "not a git repository")
		return
	}

	info := scmInfo{Staged: []scmFile{}, Changes: []scmFile{}, Log: []scmCommit{}}
	info.Branch, _ = runGit(root, "rev-parse", "--abbrev-ref", "HEAD")

	// Ahead/behind vs upstream — absent upstream just leaves both at 0.
	if ab, err := runGit(root, "rev-list", "--left-right", "--count", "@{upstream}...HEAD"); err == nil {
		if f := strings.Fields(ab); len(f) == 2 {
			info.Behind, _ = strconv.Atoi(f[0])
			info.Ahead, _ = strconv.Atoi(f[1])
		}
	}

	// -uall expands untracked directories into individual files (so each carries a
	// real filename, instead of git's default collapsed "dir/" entry).
	if st, err := runGit(root, "status", "--porcelain=v1", "-uall"); err == nil {
		info.Staged, info.Changes = parseGitStatus(st)
	}
	info.Log = parseGitLog(root)

	jsonOK(w, info)
}

// parseGitStatus splits `git status --porcelain=v1` into staged (index) and
// changed (worktree/untracked) entries. Porcelain lines are "XY path".
func parseGitStatus(out string) (staged, changes []scmFile) {
	staged, changes = []scmFile{}, []scmFile{}
	for _, line := range strings.Split(out, "\n") {
		if len(line) < 3 {
			continue
		}
		x, y := line[0], line[1]
		p := strings.TrimSpace(line[3:])
		if i := strings.Index(p, " -> "); i >= 0 { // rename: keep the new path
			p = p[i+4:]
		}
		if x != ' ' && x != '?' {
			staged = append(staged, scmFile{Path: p, Status: string(x)})
		}
		if x == '?' || y == '?' {
			changes = append(changes, scmFile{Path: p, Status: "U"})
		} else if y != ' ' {
			changes = append(changes, scmFile{Path: p, Status: string(y)})
		}
	}
	return
}

// parseGitLog returns the recent commit log. Fields are unit-separated (0x1f) so
// subjects/refs with spaces parse cleanly; %D carries the ref names.
func parseGitLog(root string) []scmCommit {
	commits := []scmCommit{}
	out, err := runGit(root, "log", "--max-count=50", "--date=short", "--pretty=format:%h%x1f%s%x1f%an%x1f%ad%x1f%D")
	if err != nil {
		return commits
	}
	for _, line := range strings.Split(out, "\n") {
		parts := strings.Split(line, "\x1f")
		if len(parts) < 4 {
			continue
		}
		refs := []string{}
		if len(parts) >= 5 && parts[4] != "" {
			for _, ref := range strings.Split(parts[4], ", ") {
				ref = strings.TrimSpace(ref)
				ref = strings.TrimPrefix(ref, "HEAD -> ")
				ref = strings.TrimPrefix(ref, "tag: ")
				if ref != "" && ref != "HEAD" {
					refs = append(refs, ref)
				}
			}
		}
		commits = append(commits, scmCommit{Hash: parts[0], Subject: parts[1], Author: parts[2], Date: parts[3], Refs: refs})
	}
	return commits
}

func handleScmCommit(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Root    string `json:"root"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Root == "" || body.Message == "" {
		jsonErr(w, http.StatusBadRequest, "root and message required")
		return
	}
	if isExcluded(body.Root, nil) {
		jsonErr(w, http.StatusForbidden, "Path is blacklisted")
		return
	}
	if !isGitRepo(body.Root) {
		jsonErr(w, http.StatusNotFound, "not a git repository")
		return
	}
	out, err := exec.Command("git", "-C", body.Root, "commit", "-m", body.Message).CombinedOutput()
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, strings.TrimSpace(string(out)))
		return
	}
	jsonOK(w, map[string]any{"ok": true})
}

func handleScmInit(w http.ResponseWriter, r *http.Request) {
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
	out, err := exec.Command("git", "-C", body.Path, "init").CombinedOutput()
	if err != nil {
		jsonErr(w, http.StatusInternalServerError, strings.TrimSpace(string(out)))
		return
	}
	jsonOK(w, map[string]any{"ok": true, "root": body.Path})
}
