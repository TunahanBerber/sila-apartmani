export const schema = `
CREATE TABLE IF NOT EXISTS expenses (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'diger',
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  due_date    DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'bekliyor' CHECK (status IN ('bekliyor', 'odendi')),
  paid_at     DATE,
  vendor      TEXT,
  recurring   TEXT NOT NULL DEFAULT 'none' CHECK (recurring IN ('none', 'monthly', 'yearly')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_due_date_idx ON expenses (due_date);
CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses (status);

CREATE TABLE IF NOT EXISTS suggestions (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  author        TEXT,
  apartment_no  TEXT,
  category      TEXT NOT NULL DEFAULT 'genel',
  status        TEXT NOT NULL DEFAULT 'yeni'
                CHECK (status IN ('yeni', 'inceleniyor', 'onaylandi', 'tamamlandi', 'reddedildi')),
  admin_note    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suggestion_votes (
  suggestion_id INT NOT NULL REFERENCES suggestions (id) ON DELETE CASCADE,
  voter_id      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (suggestion_id, voter_id)
);

CREATE TABLE IF NOT EXISTS announcements (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'onemli')),
  pinned      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
