-- ============================================================
-- NORVANA Literature Order System — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- CYCLES
CREATE TABLE cycles (
  id           SERIAL PRIMARY KEY,
  label        TEXT NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  meeting_date DATE NOT NULL,
  CONSTRAINT cycles_meeting_date_key UNIQUE (meeting_date)
);

-- GROUPS
CREATE TABLE groups (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- CATALOG_ITEMS
CREATE TABLE catalog_items (
  id          SERIAL PRIMARY KEY,
  item_no     TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price       NUMERIC(10,2) NOT NULL,
  subcategory TEXT NOT NULL CHECK (subcategory IN ('Books','Pamphlets','Keytags','Medallions','Special Orders')),
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ORDERS
CREATE TABLE orders (
  id             SERIAL PRIMARY KEY,
  group_id       INTEGER NOT NULL REFERENCES groups(id),
  contact_name   TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','paid')),
  cycle_id       INTEGER REFERENCES cycles(id),
  receipt_number TEXT UNIQUE,
  revised_total  NUMERIC(10,2),
  notes          TEXT
);

-- ORDER_ITEMS
CREATE TABLE order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id       INTEGER NOT NULL REFERENCES catalog_items(id),
  qty_ordered   INTEGER NOT NULL CHECK (qty_ordered > 0),
  qty_fulfilled INTEGER CHECK (qty_fulfilled >= 0),
  unit_price    NUMERIC(10,2) NOT NULL
);

-- ============================================================
-- ROW LEVEL SECURITY (all access goes through service role key)
-- ============================================================
ALTER TABLE cycles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items   ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS by default in Supabase — no policies needed
-- Add a permissive policy so the anon key can still read groups/catalog (needed by order form)
CREATE POLICY "public_read_groups"        ON groups        FOR SELECT USING (true);
CREATE POLICY "public_read_catalog"       ON catalog_items FOR SELECT USING (true);

-- ============================================================
-- SEED: GROUPS
-- ============================================================
INSERT INTO groups (name) VALUES
  ('Another Look'),
  ('Bring Your Stepwork'),
  ('Came to Believe'),
  ('Choose Life'),
  ('Church Basement Recovery'),
  ('Clean in Clarendon'),
  ('Cracker Box'),
  ('Foundation Steps to Freedom'),
  ('Free Yourself'),
  ('H&I'),
  ('High Noon II'),
  ('In the Heart Of'),
  ('Just for Today'),
  ('Just for Tonight'),
  ('Just Living'),
  ('Miracles on Broad Street'),
  ('NA at Walter Reed'),
  ('NA for Life'),
  ('NA in Delray'),
  ('NA in LA'),
  ('Old Time Recovery'),
  ('One Noon at a Time'),
  ('Over the Hump'),
  ('Plan B'),
  ('Recovery on the South Side'),
  ('Simplicity is the Key'),
  ('So Happy Its Thursday'),
  ('Spiritual Pause'),
  ('Step Over the Hump'),
  ('Stepping Together'),
  ('Welcome Home'),
  ('Women Do Recover');

-- ============================================================
-- SEED: CATALOG ITEMS
-- ============================================================

-- Books
INSERT INTO catalog_items (item_no, description, price, subcategory, sort_order) VALUES
('1101', 'Basic Text', 15.65, 'Books', 1),
('1130', 'Sponsorship', 11.25, 'Books', 2),
('1140', 'It Works How and Why', 12.30, 'Books', 3),
('1400', 'Step Working Guide', 11.60, 'Books', 4),
('1110', 'Spiritual Principle A Day', 14.95, 'Books', 5),
('1112', 'Just For Today Meditation Book', 12.30, 'Books', 6),
('1121', 'Miracles Happen w/ CD', 15.00, 'Books', 7),
('1150', 'Living Clean', 13.35, 'Books', 8),
('1200', 'Intro Guide To NA', 2.45, 'Books', 9),
('1201', 'Guiding Principles: The Spirit of Our Traditions', 13.35, 'Books', 10),
('1500', 'NA White Book (5 Pack)', 4.60, 'Books', 11),
('1164', '12 Concepts of Service', 2.50, 'Books', 12),
('2111', 'Guide To Local Service', 8.60, 'Books', 13),
('2110', 'Treasurers Workbook', 2.50, 'Books', 14),
('1213', 'Phone Books (10 Pack)', 4.80, 'Books', 15),
('9130', 'Readings (Set of 7)', 5.65, 'Books', 16);

-- Pamphlets (5 Pack)
INSERT INTO catalog_items (item_no, description, price, subcategory, sort_order) VALUES
('3101', 'IP #1 Who, What, How, and Why', 1.45, 'Pamphlets', 1),
('3102', 'IP #2 The Group', 1.90, 'Pamphlets', 2),
('3105', 'IP #5 Another Look', 1.45, 'Pamphlets', 3),
('3106', 'IP #6 Recovery and Relapse', 1.45, 'Pamphlets', 4),
('3107', 'IP #7 Am I an Addict?', 1.45, 'Pamphlets', 5),
('3108', 'IP #8 Just for Today', 1.45, 'Pamphlets', 6),
('3109', 'IP #9 Living the Program', 1.45, 'Pamphlets', 7),
('3111', 'IP #11 Sponsorship', 1.45, 'Pamphlets', 8),
('3112', 'IP #12 The Triangle of Self-Obsession', 1.45, 'Pamphlets', 9),
('3113', 'IP #13 By Young Addicts For Young Addicts', 1.90, 'Pamphlets', 10),
('3114', 'IP #14 One Addict''s Experience', 1.45, 'Pamphlets', 11),
('3115', 'IP #15 PI and the NA Member', 1.45, 'Pamphlets', 12),
('3116', 'IP #16 For the Newcomer', 1.45, 'Pamphlets', 13),
('3117', 'IP #17 For Those in Treatment', 1.90, 'Pamphlets', 14),
('3119', 'IP #19 Self Acceptance', 1.45, 'Pamphlets', 15),
('3120', 'IP #20 H&I Service & the NA Member', 1.45, 'Pamphlets', 16),
('3121', 'IP #21 The Loner', 1.90, 'Pamphlets', 17),
('3122', 'IP #22 Welcome to NA', 1.45, 'Pamphlets', 18),
('3123', 'IP #23 Staying Clean on the Outside', 1.45, 'Pamphlets', 19),
('3124', 'IP #24 Money Matters (5 Pack)', 2.80, 'Pamphlets', 20),
('3126', 'IP #26 Accessibility', 1.45, 'Pamphlets', 21),
('3127', 'IP #27 For the Parents or Guardians', 1.90, 'Pamphlets', 22),
('3128', 'IP #28 Funding NA Services', 2.20, 'Pamphlets', 23),
('3129', 'An Introduction to NA Meetings', 1.45, 'Pamphlets', 24),
('1604', 'NA - Community Resource', 2.40, 'Pamphlets', 25);

-- Keytags (5 Pack)
INSERT INTO catalog_items (item_no, description, price, subcategory, sort_order) VALUES
('4100', 'Welcome', 3.20, 'Keytags', 1),
('4101', '30 Days', 3.20, 'Keytags', 2),
('4102', '60 Days', 3.20, 'Keytags', 3),
('4103', '90 Days', 3.20, 'Keytags', 4),
('4104', '6 Months', 3.20, 'Keytags', 5),
('4105', '9 Months', 3.20, 'Keytags', 6),
('4106', '1 Year', 3.20, 'Keytags', 7),
('4107', '18 Months', 3.20, 'Keytags', 8),
('4108', 'Multiple', 3.20, 'Keytags', 9);

-- Medallions
INSERT INTO catalog_items (item_no, description, price, subcategory, sort_order) VALUES
('4300', '18 Months', 4.37, 'Medallions', 1),
('4301', '1 Year', 4.37, 'Medallions', 2),
('4302', '2 Years', 4.37, 'Medallions', 3),
('4303', '3 Years', 4.37, 'Medallions', 4),
('4304', '4 Years', 4.37, 'Medallions', 5),
('4305', '5 Years', 4.37, 'Medallions', 6),
('4306', '6 Years', 4.37, 'Medallions', 7),
('4307', '7 Years', 4.37, 'Medallions', 8),
('4308', '8 Years', 4.37, 'Medallions', 9),
('4309', '9 Years', 4.37, 'Medallions', 10),
('4310', '10 Years', 4.37, 'Medallions', 11),
('4311', '11 Years', 4.37, 'Medallions', 12),
('4312', '12 Years', 4.37, 'Medallions', 13),
('4313', '13 Years', 4.37, 'Medallions', 14),
('4314', '14 Years', 4.37, 'Medallions', 15),
('4315', '15 Years', 4.37, 'Medallions', 16),
('4316', '16 Years', 4.37, 'Medallions', 17),
('4317', '17 Years', 4.37, 'Medallions', 18),
('4318', '18 Years', 4.37, 'Medallions', 19),
('4319', '19 Years', 4.37, 'Medallions', 20),
('4320', '20 Years', 4.37, 'Medallions', 21),
('4321', '21 Years', 4.37, 'Medallions', 22),
('4322', '22 Years', 4.37, 'Medallions', 23),
('4323', '23 Years', 4.37, 'Medallions', 24),
('4324', '24 Years', 4.37, 'Medallions', 25),
('4325', '25 Years', 4.37, 'Medallions', 26),
('4326', '26 Years', 4.37, 'Medallions', 27),
('4327', '27 Years', 4.37, 'Medallions', 28),
('4328', '28 Years', 4.37, 'Medallions', 29),
('4329', '29 Years', 4.37, 'Medallions', 30),
('4330', '30 Years', 4.37, 'Medallions', 31),
('4399', 'Eternity', 4.37, 'Medallions', 32);

-- Special Orders (single unit unless noted)
INSERT INTO catalog_items (item_no, description, price, subcategory, sort_order) VALUES
('2202', 'Group Business Meetings', 0.29, 'Special Orders', 1),
('2203', 'Trusted Servants Roles and Responsibilities', 0.29, 'Special Orders', 2),
('2204', 'Violent and Disruptive Behavior', 0.29, 'Special Orders', 3),
('2205', 'NA Groups and Medication', 0.38, 'Special Orders', 4),
('2206', 'Principles and Leadership in NA Service', 0.38, 'Special Orders', 5),
('2207', 'Social Media & Our Guiding Principles', 0.38, 'Special Orders', 6),
('2306', 'NA and Persons Receiving Medication Asst Tx', 0.37, 'Special Orders', 7),
('3110', 'IP #10 Working Step 4 (single)', 0.95, 'Special Orders', 8),
('3118', 'IP #18 Group Booklet (single)', 1.15, 'Special Orders', 9),
('3124SO', 'IP #24 Money Matters: Self-Support in NA (single)', 0.56, 'Special Orders', 10),
('1601', 'Behind the Walls', 1.15, 'Special Orders', 11),
('1603', 'In Times of Illness (single)', 3.40, 'Special Orders', 12);
