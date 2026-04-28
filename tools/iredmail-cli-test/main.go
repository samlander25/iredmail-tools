package main

import (
	"bytes"
	"flag"
	"fmt"
	"math/rand"
	"os"
	"os/exec"
	"strings"
	"time"
)

type runner struct {
	cliPath  string
	proofCLI string
	quiet    bool
	passed   int
	failed   int
}

func printTryLine(bin string, args []string) {
	fmt.Printf("trying %s %s\n", bin, strings.Join(args, " "))
}

func printCmdOutput(output string) {
	fmt.Printf("(%s)\n", strings.TrimSpace(output))
}

func (r *runner) run(step string, args ...string) error {
	allArgs := make([]string, 0, len(args))
	allArgs = append(allArgs, args...)
	printTryLine(r.cliPath, allArgs)

	cmd := exec.Command(r.cliPath, allArgs...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out

	err := cmd.Run()
	if err != nil {
		r.failed++
		fmt.Printf("[FAIL] %s\n", step)
		printCmdOutput(out.String())
		return fmt.Errorf("%s: %w", step, err)
	}
	printCmdOutput(out.String())

	r.passed++
	if !r.quiet {
		fmt.Printf("[PASS] %s\n", step)
	}

	return nil
}

func (r *runner) runProofContains(step string, shouldContain bool, needle string, args ...string) error {
	printTryLine(r.proofCLI, args)
	cmd := exec.Command(r.proofCLI, args...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out

	err := cmd.Run()
	if err != nil {
		r.failed++
		fmt.Printf("[FAIL] %s\n", step)
		printCmdOutput(out.String())
		return fmt.Errorf("%s: %w", step, err)
	}

	output := out.String()
	found := strings.Contains(strings.ToLower(output), strings.ToLower(needle))
	if shouldContain != found {
		r.failed++
		fmt.Printf("[FAIL] %s\n", step)
		fmt.Printf("  expected contains=%t for %q\n", shouldContain, needle)
		printCmdOutput(output)
		return fmt.Errorf("%s: proof mismatch", step)
	}
	printCmdOutput(output)

	r.passed++
	if !r.quiet {
		fmt.Printf("[PASS] %s\n", step)
	}
	return nil
}

func (r *runner) runCleanup(args ...string) {
	allArgs := make([]string, 0, len(args))
	allArgs = append(allArgs, args...)
	printTryLine(r.cliPath, allArgs)

	cmd := exec.Command(r.cliPath, allArgs...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out

	err := cmd.Run()
	if err == nil {
		printCmdOutput(out.String())
		return
	}

	msg := strings.ToLower(strings.TrimSpace(out.String()))
	if strings.Contains(msg, "doesn't exist") || strings.Contains(msg, "doesn't exists") || strings.Contains(msg, "no forwardings") {
		printCmdOutput(out.String())
		return
	}

	r.failed++
	fmt.Printf("[FAIL] cleanup\n")
	printCmdOutput(out.String())
}

func randomToken(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func mustDomain(domain string) {
	if strings.TrimSpace(domain) == "" || strings.Contains(domain, "@") {
		fmt.Println("domain must be set to a valid domain, e.g. --domain example.com")
		os.Exit(2)
	}
}

func main() {
	var (
		cliPath  = flag.String("cli", "iredmail-cli", "path to iredmail-cli binary")
		proofCLI = flag.String("proof-cli", "iredmail-cli", "path to cli binary for proof/list checks")
		domain   = flag.String("domain", "", "mail domain to use for random mailboxes (required)")
		quiet    = flag.Bool("quiet", false, "suppress per-step success output")
	)
	flag.Parse()

	mustDomain(*domain)

	rand.Seed(time.Now().UnixNano())
	suffix := randomToken(8)

	mailbox1 := fmt.Sprintf("mbx1-%s@%s", suffix, *domain)
	mailbox2 := fmt.Sprintf("mbx2-%s@%s", suffix, *domain)
	password1 := "Pw1_" + randomToken(12)
	password2 := "Pw2_" + randomToken(12)
	updatedPassword1 := "Up1_" + randomToken(12)
	updatedPassword2 := "Up2_" + randomToken(12)

	fwd1a := fmt.Sprintf("fwd1a-%s@%s", randomToken(6), *domain)
	fwd1b := fmt.Sprintf("fwd1b-%s@%s", randomToken(6), *domain)
	fwd1c := fmt.Sprintf("fwd1c-%s@%s", randomToken(6), *domain)
	fwd2a := fmt.Sprintf("fwd2a-%s@%s", randomToken(6), *domain)
	fwd2b := fmt.Sprintf("fwd2b-%s@%s", randomToken(6), *domain)
	fwd2c := fmt.Sprintf("fwd2c-%s@%s", randomToken(6), *domain)

	r := &runner{cliPath: *cliPath, proofCLI: *proofCLI, quiet: *quiet}

	cleanupCommands := [][]string{}
	defer func() {
		for _, c := range cleanupCommands {
			r.runCleanup(c...)
		}

		fmt.Printf("\nSummary: %d passed, %d failed\n", r.passed, r.failed)
		if r.failed > 0 {
			os.Exit(1)
		}
	}()

	if err := r.run("add mailbox 1", "mailbox", "add", mailbox1, password1); err != nil {
		return
	}
	if err := r.runProofContains("prove mailbox 1 exists", true, mailbox1, "mailbox", "list", "--filter", mailbox1); err != nil {
		return
	}
	cleanupCommands = append(cleanupCommands, []string{"mailbox", "delete", mailbox1, "--force"})

	if err := r.run("add mailbox 2", "mailbox", "add", mailbox2, password2); err != nil {
		return
	}
	if err := r.runProofContains("prove mailbox 2 exists", true, mailbox2, "mailbox", "list", "--filter", mailbox2); err != nil {
		return
	}
	cleanupCommands = append(cleanupCommands, []string{"mailbox", "delete", mailbox2, "--force"})

	if err := r.run("update mailbox 1", "mailbox", "update", mailbox1, "--password", updatedPassword1, "--quota", "3072"); err != nil {
		return
	}
	if err := r.run("update mailbox 2", "mailbox", "update", mailbox2, "--password", updatedPassword2, "--quota", "4096"); err != nil {
		return
	}

	if err := r.run("add forwarding 1a", "forwarding", "add", mailbox1, fwd1a); err != nil {
		return
	}
	if err := r.runProofContains("prove forwarding 1a exists", true, fwd1a, "forwarding", "list", "--filter", mailbox1); err != nil {
		return
	}
	cleanupCommands = append(cleanupCommands, []string{"forwarding", "delete", mailbox1, fwd1a})

	if err := r.run("add forwarding 1b", "forwarding", "add", mailbox1, fwd1b); err != nil {
		return
	}
	if err := r.runProofContains("prove forwarding 1b exists", true, fwd1b, "forwarding", "list", "--filter", mailbox1); err != nil {
		return
	}
	cleanupCommands = append(cleanupCommands, []string{"forwarding", "delete", mailbox1, fwd1b})

	if err := r.run("add forwarding 2a", "forwarding", "add", mailbox2, fwd2a); err != nil {
		return
	}
	if err := r.runProofContains("prove forwarding 2a exists", true, fwd2a, "forwarding", "list", "--filter", mailbox2); err != nil {
		return
	}
	cleanupCommands = append(cleanupCommands, []string{"forwarding", "delete", mailbox2, fwd2a})

	if err := r.run("add forwarding 2b", "forwarding", "add", mailbox2, fwd2b); err != nil {
		return
	}
	if err := r.runProofContains("prove forwarding 2b exists", true, fwd2b, "forwarding", "list", "--filter", mailbox2); err != nil {
		return
	}
	cleanupCommands = append(cleanupCommands, []string{"forwarding", "delete", mailbox2, fwd2b})

	if err := r.run("edit forwarding 1 (delete)", "forwarding", "delete", mailbox1, fwd1a); err != nil {
		return
	}
	if err := r.run("edit forwarding 1 (add replacement)", "forwarding", "add", mailbox1, fwd1c); err != nil {
		return
	}
	if err := r.runProofContains("prove forwarding 1 replacement exists", true, fwd1c, "forwarding", "list", "--filter", mailbox1); err != nil {
		return
	}
	cleanupCommands = append(cleanupCommands, []string{"forwarding", "delete", mailbox1, fwd1c})

	if err := r.run("edit forwarding 2 (delete)", "forwarding", "delete", mailbox2, fwd2a); err != nil {
		return
	}
	if err := r.run("edit forwarding 2 (add replacement)", "forwarding", "add", mailbox2, fwd2c); err != nil {
		return
	}
	if err := r.runProofContains("prove forwarding 2 replacement exists", true, fwd2c, "forwarding", "list", "--filter", mailbox2); err != nil {
		return
	}
	cleanupCommands = append(cleanupCommands, []string{"forwarding", "delete", mailbox2, fwd2c})

	if err := r.run("remove forwarding 1b", "forwarding", "delete", mailbox1, fwd1b); err != nil {
		return
	}
	if err := r.run("remove forwarding 1c", "forwarding", "delete", mailbox1, fwd1c); err != nil {
		return
	}
	if err := r.run("remove forwarding 2b", "forwarding", "delete", mailbox2, fwd2b); err != nil {
		return
	}
	if err := r.run("remove forwarding 2c", "forwarding", "delete", mailbox2, fwd2c); err != nil {
		return
	}

	if err := r.runProofContains("prove mailbox 1 has no forwardings", true, "No forwardings", "forwarding", "list", "--filter", mailbox1); err != nil {
		return
	}
	if err := r.runProofContains("prove mailbox 2 has no forwardings", true, "No forwardings", "forwarding", "list", "--filter", mailbox2); err != nil {
		return
	}

	if err := r.run("remove mailbox 1", "mailbox", "delete", mailbox1, "--force"); err != nil {
		return
	}
	if err := r.runProofContains("prove mailbox 1 removed", true, "No mailboxes", "mailbox", "list", "--filter", mailbox1); err != nil {
		return
	}
	if err := r.run("remove mailbox 2", "mailbox", "delete", mailbox2, "--force"); err != nil {
		return
	}
	if err := r.runProofContains("prove mailbox 2 removed", true, "No mailboxes", "mailbox", "list", "--filter", mailbox2); err != nil {
		return
	}
}
