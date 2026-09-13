ALTER TABLE `deposits` ADD `analyzed_procedure` integer;--> statement-breakpoint
ALTER TABLE `deposits` ADD `exemption` text;--> statement-breakpoint
-- Ce qui était épinglé vient de la reprise, et de nulle part ailleurs : rien
-- d'autre ne posait l'épingle. Ces dépôts-là sont des archives — un fait, pas un
-- choix —, et les prendre pour des épingles remplirait la borne avant la
-- première.
UPDATE `deposits` SET `exemption` = 'archive' WHERE `pinned` = 1;
