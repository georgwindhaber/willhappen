import {
  createDiscordEmbed,
  sendDiscordNotification,
} from "./helpers/discord.ts";

import { fetchWebsiteContent } from "./helpers/scraper.ts";
import { extractDataFromWillhabenSearch } from "./helpers/willhaben.ts";

const searches = [
  {
    name: "Primary",
    queryUrl:
      "https://www.willhaben.at/iad/immobilien/mietwohnungen/mietwohnung-angebote?areaId=117223&areaId=117225&areaId=117226&areaId=117227&areaId=117228&areaId=117229&areaId=117237&sfId=b4bea2d3-89cc-4ca8-9b31-dff41d00d387&rows=30&searchKey=131&isNavigation=true&page=1&PRICE_TO=900&ESTATE_SIZE/LIVING_AREA_FROM=50",
    discordWebhookUrl:
      "https://discord.com/api/webhooks/1399328221148745728/zxPgVtEHnVXOeAelcYBVtf_OvqyIlzaF1AvtTVf9NC6xo6yBG2Gj13OMks2NCrZdte1O",
  },
  {
    name: "Secondary",
    queryUrl:
      "https://www.willhaben.at/iad/immobilien/mietwohnungen/mietwohnung-angebote?areaId=117223&areaId=117225&areaId=117226&areaId=117227&areaId=117228&areaId=117229&areaId=117237&sfId=b4bea2d3-89cc-4ca8-9b31-dff41d00d387&rows=30&searchKey=131&isNavigation=true&page=1&PRICE_TO=900&ESTATE_SIZE/LIVING_AREA_FROM=40&ESTATE_SIZE/LIVING_AREA_TO=49",
    discordWebhookUrl:
      "https://discord.com/api/webhooks/1399328455430115368/fzh0n2S3TBj9QUxfqTDhl7BjHOdDH0V3-Igl-38a9AJaC-4t8XZ5Kc6bjqCOyFrNjI-u",
  },
];

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  console.log("Willhappen monitor started 🚀");

  console.log("Send test discord message", new Date());

  const websiteHtml = await fetchWebsiteContent(searches[0].queryUrl);

  if (websiteHtml) {
    const appartmentData = extractDataFromWillhabenSearch(websiteHtml);

    for (const appartment of appartmentData) {
      // console.log(appartment);
      await sendDiscordNotification(
        searches[0].discordWebhookUrl,

        createDiscordEmbed(appartment)
      );
    }
  } else {
    console.error("Could not query", searches[0].name);
  }
}
