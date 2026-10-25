// Package migrations embeds the SQL migrations into the binary.
package migrations

import "embed"

// Files holds every NNNN_name.sql migration, applied in name order.
//
//go:embed *.sql
var Files embed.FS
