package docker

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

type Client struct {
	timeout time.Duration
}

func NewClient() *Client {
	return &Client{
		timeout: 2 * time.Minute,
	}
}

func (c *Client) Exec(containerName string, command string) (string, error) {
	if strings.TrimSpace(command) == "" {
		return "", nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), c.timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "docker", "exec", "-w", "/app/workspace/work", containerName, "sh", "-c", command)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	output := stdout.String() + stderr.String()

	if err != nil {
		return output, fmt.Errorf("command failed: %v", err)
	}

	return output, nil
}

func (c *Client) Run(name, image string, detach bool) error {
	args := []string{"run"}
	if detach {
		args = append(args, "-d")
	}
	args = append(args, []string{"--name", name, image, "sleep", "infinity"}...)

	cmd := exec.Command("docker", args...)
	return cmd.Run()
}

func (c *Client) Stop(name string) error {
	cmd := exec.Command("docker", "stop", name)
	return cmd.Run()
}

func (c *Client) Remove(name string) error {
	cmd := exec.Command("docker", "rm", "-f", name)
	return cmd.Run()
}

func (c *Client) List() ([]string, error) {
	cmd := exec.Command("docker", "ps", "--format", "{{.Names}}")
	var out bytes.Buffer
	cmd.Stdout = &out

	if err := cmd.Run(); err != nil {
		return nil, err
	}

	var containers []string
	for _, name := range strings.Split(out.String(), "\n") {
		name = strings.TrimSpace(name)
		if name != "" {
			containers = append(containers, name)
		}
	}
	return containers, nil
}
