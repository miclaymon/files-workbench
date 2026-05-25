package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
)

const version = "v2"
const apiPrefix = "/_api/" + version

// repoRoot is the root of the files-workbench2 repo, computed at startup.
var repoRoot string

func main() {
	// Determine repo root: two levels up from server/v2/
	exe, err := os.Executable()
	if err != nil {
		log.Fatal(err)
	}
	dir := filepath.Dir(exe)
	// When running via `go run`, the binary is in a temp dir — use source dir instead.
	if _, src, _, ok := runtime.Caller(0); ok {
		dir = filepath.Dir(src) // server/v2
	}
	repoRoot = filepath.Join(dir, "..", "..")
	repoRoot, _ = filepath.Abs(repoRoot)

	if err := loadBlacklist(filepath.Join(repoRoot, "server", "v1", "blacklist.yaml")); err != nil {
		log.Printf("warn: could not load blacklist: %v", err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}

	mux := http.NewServeMux()
	registerRoutes(mux)

	log.Printf("Files Workbench API %s listening on :%s", version, port)
	log.Fatal(http.ListenAndServe(":"+port, cors(mux)))
}

// cors adds permissive CORS headers to every response.
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func registerRoutes(mux *http.ServeMux) {
	// Health
	mux.HandleFunc("GET /health", handleHealth)

	// App
	mux.HandleFunc("GET "+apiPrefix+"/app/init", handleAppInit)

	// Filesystem
	mux.HandleFunc("GET "+apiPrefix+"/fs/stat", handleFsStat)
	mux.HandleFunc("GET "+apiPrefix+"/fs/list_dir", handleFsListDir)
	mux.HandleFunc("GET "+apiPrefix+"/fs/preview", handleFsPreview)
	mux.HandleFunc("POST "+apiPrefix+"/fs/open_with_system", handleFsOpenWithSystem)
	mux.HandleFunc("POST "+apiPrefix+"/fs/create_file", handleFsCreateFile)
	mux.HandleFunc("POST "+apiPrefix+"/fs/create_dir", handleFsCreateDir)
	mux.HandleFunc("POST "+apiPrefix+"/fs/write_file", handleFsWriteFile)

	// Media
	mux.HandleFunc("GET "+apiPrefix+"/media/capabilities", handleMediaCapabilities)
	mux.HandleFunc("GET "+apiPrefix+"/media/image", handleMediaImage)
	mux.HandleFunc("GET "+apiPrefix+"/media/thumbnail", handleMediaThumbnail)
	mux.HandleFunc("GET "+apiPrefix+"/media/preview", handleMediaPreview)
	mux.HandleFunc("GET "+apiPrefix+"/media/preview/text", handleMediaPreviewText)
	mux.HandleFunc("GET "+apiPrefix+"/media/metadata", handleMediaMetadata)
	mux.HandleFunc("GET "+apiPrefix+"/media/artwork", handleMediaArtwork)

	// Explorer
	mux.HandleFunc("GET "+apiPrefix+"/Explorer/categories", handleExplorerCategories)
	mux.HandleFunc("GET "+apiPrefix+"/Explorer/root", handleExplorerRoot)
	mux.HandleFunc("GET "+apiPrefix+"/Explorer/home", handleExplorerHome)
	mux.HandleFunc("GET "+apiPrefix+"/Explorer/drives", handleExplorerDrives)
	mux.HandleFunc("GET "+apiPrefix+"/Explorer", handleExplorer)

	// Preferences
	mux.HandleFunc("GET "+apiPrefix+"/preferences/schema", handlePreferencesSchema)
	mux.HandleFunc("GET "+apiPrefix+"/preferences", handlePreferencesGet)
	mux.HandleFunc("PUT "+apiPrefix+"/preferences", handlePreferencesPut)

	// Perf
	mux.HandleFunc("POST "+apiPrefix+"/perf", handlePerf)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]string{"status": "ok"})
}

func handleAppInit(w http.ResponseWriter, r *http.Request) {
	home, _ := os.UserHomeDir()
	jsonOK(w, map[string]string{"homePath": home})
}

// jsonOK writes a JSON 200 response.
func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		log.Printf("json encode error: %v", err)
	}
}

// jsonErr writes a JSON error response.
func jsonErr(w http.ResponseWriter, status int, detail string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"detail": detail})
}
