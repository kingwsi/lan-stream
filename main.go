package main

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const historyFile = "history.json"
const configFile = "config.json"

// Config holds application configuration
type Config struct {
	UploadDirectory string `json:"upload_directory"`
	Port            string `json:"port"`
}

var config Config

// Message represents a message in the history
type Message struct {
	Type      string    `json:"type"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
}

// History stores the last N messages
type History struct {
	messages []Message
	mu       sync.Mutex
	maxSize  int
}

// NewHistory creates a new History
func NewHistory(maxSize int) *History {
	return &History{
		messages: make([]Message, 0, maxSize),
		maxSize:  maxSize,
	}
}

// Add adds a message to the history
func (h *History) Add(message Message) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.maxSize > 0 && len(h.messages) >= h.maxSize {
		h.messages = h.messages[1:]
	}
	h.messages = append(h.messages, message)
}

// Get returns all messages in the history
func (h *History) Get() []Message {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.messages
}

// Delete removes a message from the history
func (h *History) Delete(timestamp time.Time) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for i, msg := range h.messages {
		if msg.Timestamp.Equal(timestamp) {
			h.messages = append(h.messages[:i], h.messages[i+1:]...)
			break
		}
	}
}

// LoadHistory loads history from a file
func (h *History) LoadHistory() {
	h.mu.Lock()
	defer h.mu.Unlock()

	data, err := ioutil.ReadFile(historyFile)
	if err != nil {
		log.Println("Could not read history file:", err)
		return
	}

	if err := json.Unmarshal(data, &h.messages); err != nil {
		log.Println("Could not parse history file:", err)
	}
}

// SaveHistory saves history to a file
func (h *History) SaveHistory() {
	h.mu.Lock()
	defer h.mu.Unlock()

	data, err := json.MarshalIndent(h.messages, "", "  ")
	if err != nil {
		log.Println("Could not marshal history:", err)
		return
	}

	if err := ioutil.WriteFile(historyFile, data, 0644); err != nil {
		log.Println("Could not write history file:", err)
	}
}

var history = NewHistory(0)      // Store all messages/files
var recentHistory = NewHistory(10) // Store last 10 messages/files

// Hub manages all WebSocket clients
type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.Mutex
}

// NewHub creates a new Hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

// Run starts the Hub's event loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.Lock()
			for client := range h.clients {
				if err := client.WriteMessage(websocket.TextMessage, message); err != nil {
					log.Println("write:", err)
					h.unregister <- client
				}
			}
			h.mu.Unlock()
		}
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all connections
	},
}

func loadConfiguration() {
	// Set default values
	config.UploadDirectory = "uploads"
	config.Port = "8080"

	file, err := os.Open(configFile)
	if err != nil {
		if os.IsNotExist(err) {
			log.Println("Config file not found, creating a default one.")
			data, _ := json.MarshalIndent(config, "", "  ")
			_ = ioutil.WriteFile(configFile, data, 0644)
			return
		}
		log.Fatal("Could not open config file:", err)
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&config); err != nil {
		log.Fatal("Could not parse config file:", err)
	}
}

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	hub.register <- conn

	// History is now loaded via pagination API, not through WebSocket
	// This prevents duplicate messages

	defer func() {
		hub.unregister <- conn
	}()

	for {
		mt, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			break
		}
		if mt == websocket.TextMessage {
			msg := Message{Type: "text", Content: string(message), Timestamp: time.Now()}
			history.Add(msg)
			history.SaveHistory()
			recentHistory.Add(msg)
			jsonMsg, _ := json.Marshal(msg)
			hub.broadcast <- jsonMsg
		}
	}
}

func uploadFile(hub *Hub, w http.ResponseWriter, r *http.Request) {
	r.ParseMultipartForm(10 << 20) // 10 MB
	file, handler, err := r.FormFile("file")
	if err != nil {
		log.Println("Error Retrieving the File", err)
		return
	}
	defer file.Close()

	uploadsDir := config.UploadDirectory
	if _, err := os.Stat(uploadsDir); os.IsNotExist(err) {
		os.MkdirAll(uploadsDir, 0755)
	}

	dst, err := os.Create(filepath.Join(uploadsDir, handler.Filename))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	msg := Message{Type: "file", Content: handler.Filename, Timestamp: time.Now()}
	history.Add(msg)
	history.SaveHistory()
	recentHistory.Add(msg)
	jsonMsg, _ := json.Marshal(msg)
	hub.broadcast <- jsonMsg

	fmt.Fprintf(w, "Successfully Uploaded File\n")
}

func serveHistory(w http.ResponseWriter, r *http.Request) {
	filterType := r.URL.Query().Get("type")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	
	allMessages := history.Get()
	
	// Create a copy to reverse
	messages := make([]Message, len(allMessages))
	for i, msg := range allMessages {
		messages[len(allMessages)-1-i] = msg
	}

	// Filter by type if specified
	if filterType != "" {
		filteredMessages := make([]Message, 0)
		for _, msg := range messages {
			if msg.Type == filterType {
				filteredMessages = append(filteredMessages, msg)
			}
		}
		messages = filteredMessages
	}

	// Apply pagination if limit is specified
	totalCount := len(messages)
	if limitStr != "" {
		limit := 20 // default
		if l, err := fmt.Sscanf(limitStr, "%d", &limit); err == nil && l == 1 {
			// limit parsed successfully
		}
		
		offset := 0
		if offsetStr != "" {
			if o, err := fmt.Sscanf(offsetStr, "%d", &offset); err == nil && o == 1 {
				// offset parsed successfully
			}
		}

		// Calculate slice bounds
		start := offset
		if start > totalCount {
			start = totalCount
		}
		
		end := start + limit
		if end > totalCount {
			end = totalCount
		}

		messages = messages[start:end]
	}

	// Return response with pagination info
	response := map[string]interface{}{
		"messages": messages,
		"total":    totalCount,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func deleteHistoryItem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var msgToDelete Message
	if err := json.NewDecoder(r.Body).Decode(&msgToDelete); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if msgToDelete.Type == "file" {
		filePath := filepath.Join(config.UploadDirectory, msgToDelete.Content)
		if err := os.Remove(filePath); err != nil {
			log.Println("Could not delete file:", err)
		}
	}

	history.Delete(msgToDelete.Timestamp)
	recentHistory.Delete(msgToDelete.Timestamp) // Also delete from recent history
	history.SaveHistory()

	w.WriteHeader(http.StatusOK)
}

func clearHistory(hub *Hub) error {
	// Clear in-memory history
	history.mu.Lock()
	history.messages = make([]Message, 0)
	history.mu.Unlock()

	recentHistory.mu.Lock()
	recentHistory.messages = make([]Message, 0)
	recentHistory.mu.Unlock()

	// Clear history file
	if err := ioutil.WriteFile(historyFile, []byte("[]"), 0644); err != nil {
		log.Println("Could not clear history file:", err)
		return err
	}

	// Clear uploaded files
	uploadsDir := config.UploadDirectory
	if err := os.RemoveAll(uploadsDir); err != nil {
		log.Println("Could not remove uploads directory:", err)
		return err
	}
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		log.Println("Could not recreate uploads directory:", err)
		return err
	}

	// Notify clients
	clearMsg := Message{Type: "clear"}
	jsonMsg, _ := json.Marshal(clearMsg)
	hub.broadcast <- jsonMsg

	return nil
}

func main() {
	loadConfiguration()
	history.LoadHistory()
	// Populate recent history from the loaded history
	for _, msg := range history.Get() {
		recentHistory.Add(msg)
	}

	hub := NewHub()
	go hub.Run()

	// Serve the main page
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "static/index.html")
	})

	// Serve static files (CSS, JS)
	fs := http.FileServer(http.Dir("static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	// Serve uploaded files
	ufs := http.FileServer(http.Dir(config.UploadDirectory))
	http.Handle("/uploads/", http.StripPrefix("/uploads/", ufs))

	// WebSocket endpoint
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})

	// File upload endpoint
	http.HandleFunc("/upload", func(w http.ResponseWriter, r *http.Request) {
		uploadFile(hub, w, r)
	})

	// History endpoint
	http.HandleFunc("/history", serveHistory)

	// Delete history item endpoint
	http.HandleFunc("/history/delete", deleteHistoryItem)

	// Clear history endpoint
	http.HandleFunc("/history/clear", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
			return
		}
		if err := clearHistory(hub); err != nil {
			http.Error(w, "Failed to clear history", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	// Get local IP address
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		log.Println("Could not get local IP address:", err)
	}

	fmt.Println("Server is running...")
	fmt.Printf("Open your browser and go to http://localhost:%s\n", config.Port)
	fmt.Println("Or on other devices in the same network, use one of these addresses:")
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				fmt.Printf("http://%s:%s\n", ipnet.IP.String(), config.Port)
			}
		}
	}

	log.Fatal(http.ListenAndServe(":"+config.Port, nil))
}