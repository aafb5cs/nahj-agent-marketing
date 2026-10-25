package db_test

import (
	"errors"

	"github.com/jmoiron/sqlx"
)

type sqlxTx = sqlx.Tx

var errBoom = errors.New("boom")
