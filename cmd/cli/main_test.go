// Package main provides CLI tests for HermitShell.
//
// Reference: See docs/cloudflared.md for tunnel management details.
package main

import (
	"flag"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestHandleTunnelWithHealthyTunnel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tunnel-url" {
			w.Write([]byte(`{"url": "https://abc123.trycloudflare.com", "healthy": true}`))
			return
		}
		w.WriteHeader(404)
	}))
	defer server.Close()

	oldAPIBase := apiBase
	apiBase = server.URL
	defer func() { apiBase = oldAPIBase }()

	tunnelCmd := newTunnelCmd()
	handleTunnel(tunnelCmd)
}

func TestHandleTunnelWithUnhealthyTunnel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tunnel-url" {
			w.Write([]byte(`{"url": "https://abc123.trycloudflare.com", "healthy": false}`))
			return
		}
		w.WriteHeader(404)
	}))
	defer server.Close()

	oldAPIBase := apiBase
	apiBase = server.URL
	defer func() { apiBase = oldAPIBase }()

	tunnelCmd := newTunnelCmd()
	handleTunnel(tunnelCmd)
}

func TestHandleTunnelNoTunnel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tunnel-url" {
			w.Write([]byte(`{"url": "", "healthy": false}`))
			return
		}
		w.WriteHeader(404)
	}))
	defer server.Close()

	oldAPIBase := apiBase
	apiBase = server.URL
	defer func() { apiBase = oldAPIBase }()

	tunnelCmd := newTunnelCmd()

	exited := false
	exitFunc = func(code int) {
		exited = true
	}
	defer func() { exitFunc = os.Exit }()

	handleTunnel(tunnelCmd)

	if !exited {
		t.Error("Expected exit for no tunnel")
	}
}

func TestHandleTunnelDomainMode(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tunnel-url" {
			w.Write([]byte(`{"domainMode": true, "url": "", "healthy": false}`))
			return
		}
		w.WriteHeader(404)
	}))
	defer server.Close()

	oldAPIBase := apiBase
	apiBase = server.URL
	defer func() { apiBase = oldAPIBase }()

	tunnelCmd := newTunnelCmd()

	exited := false
	exitFunc = func(code int) {
		exited = true
	}
	defer func() { exitFunc = os.Exit }()

	handleTunnel(tunnelCmd)
	if !exited {
		t.Error("Expected exit for domain mode")
	}
}

func TestCheckCloudflaredBinary(t *testing.T) {
	err := checkCloudflaredBinary()
	if err != nil {
		t.Logf("cloudflared not found (expected on systems without cloudflared): %v", err)
	}
}

func newTunnelCmd() *flag.FlagSet {
	return flag.NewFlagSet("tunnel", flag.ExitOnError)
}
