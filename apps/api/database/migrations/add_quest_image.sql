-- The pinned banner for a quest, copied out of its metadata document at index time.
--
-- The indexer already fetched the document to read the title and the cadence, and threw the picture
-- away. Every page that wanted it re-fetched from an IPFS gateway in the browser, which is a second
-- round trip per card and a blank rectangle whenever the gateway is slow.
--
-- Nullable, and deliberately: a quest published without a banner has none, and the page shows the
-- artwork for its action type instead.
ALTER TABLE indexed_quests ADD COLUMN IF NOT EXISTS image TEXT;
