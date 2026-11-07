-- Deck On/Off belongs to the member, alongside color1/color2.
-- Clean/Normal remains an in-session presentation choice.
ALTER TABLE members ADD COLUMN deck_enabled TINYINT NOT NULL DEFAULT 1;
