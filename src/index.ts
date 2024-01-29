/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { InteractionResponseFlags, InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import { getTopSevenGGEmotes, Emote } from "./sevengg";
import { json } from "./utils";
import { commands } from "./commands";
import { onClashCommand } from "./clash";

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	KV: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;

	DISCORD_PUBLIC_KEY: string;
	DISCORD_APPLICATION_ID: string;
	DISCORD_TOKEN: string;
	RIOT_API_KEY: string;

	ADMIN_PASSWORD: string;
}

async function update(env: Env) {
	const url = `https://discord.com/api/v10/applications/${env.DISCORD_APPLICATION_ID}/commands`;
	const body = Object.values(commands);
	const response = await fetch(url, {
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bot ${env.DISCORD_TOKEN}`,
		},
		method: "PUT",
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		console.error("Error registering commands");
		const text = await response.text();
		console.error(text);
	}
	console.log("Registered commands");

	const topEmotes = await getTopSevenGGEmotes();
	await env.KV.put("emotes", JSON.stringify(topEmotes));
	console.log("Updated " + topEmotes.length + " emotes");
}

async function onEmoteCommand(interaction: any, env: Env) {
	const emoteName = interaction.data.options[0].value;
	const emotes = JSON.parse((await env.KV.get("emotes")) || "[]") as Emote[];

	const emote = emotes.find((e) => e.name === emoteName);
	if (!emote) {
		return json({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content: "Emote not found",
				flags: InteractionResponseFlags.EPHEMERAL,
			},
		});
	}

	return json({
		type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			content: `https://cdn.7tv.app/emote/${emote.id}/2x.${emote.animated ? "gif" : "png"}`,
		},
	});
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		if (request.method === "GET" && url.pathname === "/update" && url.searchParams.get("password") === env.ADMIN_PASSWORD) {
			await update(env);
			return new Response("Updated emotes");
		}

		if (request.method !== "POST") {
			return new Response("Not found.", { status: 404 });
		}

		// Using the incoming headers, verify this request actually came from discord.
		const signature = request.headers.get("x-signature-ed25519") ?? "";
		const timestamp = request.headers.get("x-signature-timestamp") ?? "";
		const body = await request.clone().arrayBuffer();
		const isValidRequest = verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
		if (!isValidRequest) {
			console.error("Invalid Request");
			return new Response("Bad request signature.", { status: 401 });
		}

		const interaction = (await request.json()) as any;

		console.log(interaction);

		switch (interaction.type) {
			case InteractionType.APPLICATION_COMMAND:
				switch (interaction.data.name.toLowerCase()) {
					case "e":
						return onEmoteCommand(interaction, env);
					case "clash":
						return onClashCommand(interaction, env);
					case "update":
						if (interaction.member.user.id !== "212219167087132672") {
							return json({
								type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
								data: {
									content: "You are not allowed to use this command",
									flags: InteractionResponseFlags.EPHEMERAL,
								},
							});
						}
						await update(env);
						return new Response("Updated emotes");
				}
				break;
			case InteractionType.PING:
				return json({ type: InteractionResponseType.PONG });
		}

		console.error("Unknown interaction type:", interaction.type);
		return new Response("Unknown interaction type.", { status: 400 });
	},
};
