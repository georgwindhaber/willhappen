import type { WillhabenAppartment } from "../types/general.ts";

export const createDiscordEmbed = (infos: WillhabenAppartment) => ({
  embeds: [
    {
      title: `🆕 ${infos.title}`,
      description: `${infos.price} | ${infos.rooms} | ${infos.area}`,
      color: 0xcc0000,
      timestamp: new Date().toISOString(),
      url: infos.url,
      image: {
        url: infos.imageUrl,
      },
    },
  ],
});

export const sendDiscordNotification = async (
  webhookUrl: string,
  payload: object
) => {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log(data);

    return response.ok;
  } catch (error) {
    console.error(
      `Error sending Discord notification to ${webhookUrl}:`,
      error
    );
    return false;
  }
};
