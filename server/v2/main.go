package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sync"
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

	loadPlugins()

	dataPort := os.Getenv("PORT")
	if dataPort == "" {
		dataPort = "8001"
	}
	controlPort := os.Getenv("CONTROL_PORT")
	if controlPort == "" {
		controlPort = "8002"
	}

	dataMux := http.NewServeMux()
	controlMux := http.NewServeMux()
	registerDataRoutes(dataMux)
	registerControlRoutes(controlMux)

	var wg sync.WaitGroup
	serve := func(label, port string, h http.Handler) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			log.Printf("Files Workbench %s server (%s) listening on :%s", version, label, port)
			if err := http.ListenAndServe(":"+port, cors(h)); err != nil {
				log.Fatalf("%s server: %v", label, err)
			}
		}()
	}

	serve("data", dataPort, dataMux)
	serve("control", controlPort, controlMux)
	wg.Wait()
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

// registerDataRoutes registers all read-only GET endpoints on the data server.
func registerDataRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET "+apiPrefix+"/app/init", handleAppInit)

	// Filesystem — reads
	mux.HandleFunc("GET "+apiPrefix+"/fs/stat", handleFsStat)
	mux.HandleFunc("GET "+apiPrefix+"/fs/list_dir", handleFsListDir)
	mux.HandleFunc("GET "+apiPrefix+"/fs/dir_size", handleFsDirSize)
	mux.HandleFunc("GET "+apiPrefix+"/fs/preview", handleFsPreview)
	mux.HandleFunc("GET "+apiPrefix+"/fs/archive/capabilities", handleArchiveCapabilities)
	mux.HandleFunc("GET "+apiPrefix+"/fs/archive/ls", handleFsArchiveLs)
	mux.HandleFunc("GET "+apiPrefix+"/fs/customization", handleFsCustomizationGet)
	mux.HandleFunc("GET "+apiPrefix+"/fs/permissions", handleFsPermissions)
	mux.HandleFunc("GET "+apiPrefix+"/fs/checksums", handleFsChecksums)

	// Media
	mux.HandleFunc("GET "+apiPrefix+"/media/capabilities", handleMediaCapabilities)
	mux.HandleFunc("GET "+apiPrefix+"/media/image", handleMediaImage)
	mux.HandleFunc("GET "+apiPrefix+"/media/thumbnail", handleMediaThumbnail)
	mux.HandleFunc("GET "+apiPrefix+"/media/preview", handleMediaPreview)
	mux.HandleFunc("GET "+apiPrefix+"/media/preview/text", handleMediaPreviewText)
	mux.HandleFunc("GET "+apiPrefix+"/media/metadata", handleMediaMetadata)
	mux.HandleFunc("GET "+apiPrefix+"/media/artwork", handleMediaArtwork)
	mux.HandleFunc("GET "+apiPrefix+"/media/exe_icon", handleMediaExeIcon)
	mux.HandleFunc("GET "+apiPrefix+"/media/exe_info", handleMediaExeInfo)
	mux.HandleFunc("GET "+apiPrefix+"/media/exif", handleMediaExif)
	mux.HandleFunc("GET "+apiPrefix+"/media/audio_tags", handleMediaAudioTags)

	// Explorer
	mux.HandleFunc("GET "+apiPrefix+"/Explorer/categories", handleExplorerCategories)
	mux.HandleFunc("GET "+apiPrefix+"/Explorer/root", handleExplorerRoot)
	mux.HandleFunc("GET "+apiPrefix+"/Explorer/home", handleExplorerHome)
	mux.HandleFunc("GET "+apiPrefix+"/Explorer/drives", handleExplorerDrives)
	mux.HandleFunc("GET "+apiPrefix+"/Explorer", handleExplorer)

	// Preferences — reads
	mux.HandleFunc("GET "+apiPrefix+"/preferences/schema", handlePreferencesSchema)
	mux.HandleFunc("GET "+apiPrefix+"/preferences", handlePreferencesGet)

	// Source control — reads
	mux.HandleFunc("POST "+apiPrefix+"/scm/detect", handleScmDetect)
	mux.HandleFunc("GET "+apiPrefix+"/scm/info", handleScmInfo)

	// Icon packs
	mux.HandleFunc("GET "+apiPrefix+"/icons/manifest", handleIconsManifest)
	mux.HandleFunc("GET "+apiPrefix+"/icons/svg", handleIconsSvg)
}

// registerControlRoutes registers all mutating POST/PUT endpoints on the control server.
func registerControlRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", handleHealth)

	// Filesystem — writes
	mux.HandleFunc("POST "+apiPrefix+"/fs/open_with_system", handleFsOpenWithSystem)
	mux.HandleFunc("POST "+apiPrefix+"/fs/open_terminal", handleFsOpenTerminal)
	mux.HandleFunc("POST "+apiPrefix+"/fs/create_file", handleFsCreateFile)
	mux.HandleFunc("POST "+apiPrefix+"/fs/create_dir", handleFsCreateDir)
	mux.HandleFunc("POST "+apiPrefix+"/fs/write_file", handleFsWriteFile)
	mux.HandleFunc("POST "+apiPrefix+"/fs/rename", handleFsRename)
	mux.HandleFunc("POST "+apiPrefix+"/fs/move", handleFsMove)
	mux.HandleFunc("POST "+apiPrefix+"/fs/copy", handleFsCopy)
	mux.HandleFunc("POST "+apiPrefix+"/fs/delete", handleFsDelete)
	mux.HandleFunc("POST "+apiPrefix+"/fs/delete/elevated", handleFsDeleteElevated)
	mux.HandleFunc("POST "+apiPrefix+"/fs/trash", handleFsTrash)
	mux.HandleFunc("POST "+apiPrefix+"/fs/trash/elevated", handleFsTrashElevated)
	mux.HandleFunc("POST "+apiPrefix+"/fs/compress", handleFsCompress)
	mux.HandleFunc("POST "+apiPrefix+"/fs/decompress", handleFsDecompress)
	mux.HandleFunc("PUT "+apiPrefix+"/fs/customization", handleFsCustomizationPut)

	// Preferences — writes
	mux.HandleFunc("PUT "+apiPrefix+"/preferences", handlePreferencesPut)

	// Source control — writes
	mux.HandleFunc("POST "+apiPrefix+"/scm/commit", handleScmCommit)
	mux.HandleFunc("POST "+apiPrefix+"/scm/init", handleScmInit)

	// Perf logging
	mux.HandleFunc("POST "+apiPrefix+"/perf", handlePerf)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]string{"status": "ok"})
}

func handleAppInit(w http.ResponseWriter, r *http.Request) {
	home, _ := os.UserHomeDir()
	jsonOK(w, map[string]string{"homePath": home, "platform": runtime.GOOS})
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
