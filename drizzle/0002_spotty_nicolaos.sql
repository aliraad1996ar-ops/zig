ALTER TABLE `players` ADD `score_season` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_players_season_best` ON `players` (`score_season`,`best`);