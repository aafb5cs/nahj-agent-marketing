// Command server runs the Nahj Seller Marketplace backend.
//
//	server api      HTTP API
//	server worker   background jobs (outbox and scheduler)
//	server migrate  apply database migrations, then exit
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/api"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/idempotency"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/identity"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/ops"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/clock"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/config"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/db"
	"github.com/aafb5cs/nahj-agent-marketing/backend/internal/platform/logging"
	"github.com/aafb5cs/nahj-agent-marketing/backend/migrations"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: server api|worker|migrate")
		os.Exit(2)
	}
	mode := config.Mode(os.Args[1])
	log := logging.New("agent-marketing-" + string(mode))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	var err error
	switch mode {
	case config.ModeAPI:
		err = runAPI(ctx, log)
	case config.ModeWorker:
		err = runWorker(ctx, log)
	case config.ModeMigrate:
		err = runMigrate(ctx, log)
	default:
		err = fmt.Errorf("unknown command %q (use api, worker or migrate)", mode)
	}
	if err != nil {
		log.Error("exit", "error", err.Error())
		os.Exit(1)
	}
}

func runMigrate(ctx context.Context, log *slog.Logger) error {
	cfg, err := config.Load(config.ModeMigrate)
	if err != nil {
		return err
	}
	ran, err := db.Migrate(ctx, cfg.DBDSN, migrations.Files)
	if err != nil {
		return err
	}
	log.Info("migrations applied", "count", len(ran), "versions", ran)
	return nil
}

func runAPI(ctx context.Context, log *slog.Logger) error {
	cfg, err := config.Load(config.ModeAPI)
	if err != nil {
		return err
	}
	conn, err := db.Open(ctx, cfg.DBDSN)
	if err != nil {
		return err
	}
	defer conn.Close()
	clk := clock.System{}

	sessions := identity.NewSessions(conn, clk, cfg.SessionKey, cfg.SessionTTL)
	verifier, err := identity.NewKeycloakVerifier(ctx, cfg.OIDC.Issuer, cfg.OIDC.AllowedAZP)
	if err != nil {
		return fmt.Errorf("keycloak discovery: %w", err)
	}
	login, err := identity.NewWebLogin(ctx, identity.LoginConfig{
		Issuer: cfg.OIDC.Issuer, ClientID: cfg.OIDC.ClientID, ClientSecret: cfg.OIDC.ClientSecret,
		RedirectURL: cfg.OIDC.RedirectURL, SessionKey: cfg.SessionKey, CookieSecure: cfg.CookieSecure, SessionTTL: cfg.SessionTTL,
	}, sessions, clk)
	if err != nil {
		return fmt.Errorf("keycloak login: %w", err)
	}

	engine, _ := api.New(api.Deps{
		DB:           conn,
		Clock:        clk,
		Log:          log,
		Auth:         &identity.Authenticator{Sessions: sessions, Verifier: verifier, Staff: identity.NewStaffStore(conn, clk), Clock: clk},
		Sessions:     sessions,
		Login:        login,
		Idempotency:  idempotency.NewStore(conn, clk),
		CookieSecure: cfg.CookieSecure,
	})

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           engine,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       90 * time.Second,
	}
	errc := make(chan error, 1)
	go func() {
		log.Info("api listening", "addr", cfg.HTTPAddr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errc <- err
		}
		close(errc)
	}()
	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	shutdown, cancel := context.WithTimeout(context.Background(), cfg.ShutdownGraceTime)
	defer cancel()
	log.Info("api shutting down")
	return srv.Shutdown(shutdown)
}

func runWorker(ctx context.Context, log *slog.Logger) error {
	cfg, err := config.Load(config.ModeWorker)
	if err != nil {
		return err
	}
	conn, err := db.Open(ctx, cfg.DBDSN)
	if err != nil {
		return err
	}
	defer conn.Close()
	clk := clock.System{}

	w := &ops.Worker{DB: conn, Clock: clk, Log: log, ID: cfg.WorkerID, Batch: cfg.WorkerBatch, Poll: cfg.WorkerPoll}
	w.Register(ops.KindMaintenance, (&ops.Maintenance{DB: conn, Clock: clk}).Handle)

	sched := &ops.Scheduler{DB: conn, Clock: clk, Every: map[string]time.Duration{ops.KindMaintenance: cfg.MaintenanceEvery}}
	go sched.Run(ctx)
	return w.Run(ctx)
}
