import { InteractionResponseType, InteractionResponseFlags } from "discord-interactions";
import { Env } from ".";
import { json } from "./utils";

import { PlatformId, RiotAPI, RiotAPITypes } from "@fightmegg/riot-api";

async function getClashTeam(riot: RiotAPI, username: string, usertag: string) {
	const region = PlatformId.EUW1;
	const regionGroup = PlatformId.EUROPE;

	const { puuid } = await riot.account.getByRiotId({
		gameName: username,
		tagLine: usertag,
		region: regionGroup,
	});

	const summoner = await riot.summoner.getByPUUID({
		puuid,
		region,
	}); //lol.Summoner.getByPUUID(puuid, region);

	const clashSignups = await riot.clash.getPlayersBySummonerId({
		summonerId: summoner.id,
		region,
	});
	if (clashSignups.length === 0) throw new Error("No clash signups found for this player");

	const currentSignup = clashSignups[0];

	if (!currentSignup.teamId) throw new Error("No team found for this player's clash signup");

	const team = await riot.clash.getTeamById({ teamId: currentSignup.teamId, region: region });

	const players = Object.fromEntries(
		await Promise.all(
			team.players.map(async (player) => {
				const summoner = await riot.summoner.getBySummonerId({ summonerId: player.summonerId, region });

				const account = await riot.account.getByPUUID({ puuid: summoner.puuid, region: regionGroup });

				return [player.summonerId, account] as const;
			})
		)
	);

	return {
		team,
		players,
	};
}

function getPorofessorLink(players: RiotAPITypes.Account.AccountDTO[]) {
	return `https://porofessor.gg/pregame/euw/${players
		.map((p) => encodeURIComponent(p.gameName + "-" + p.tagLine))
		.join(",")}/ranked-only/season`;
}

function positionToNumber(position: RiotAPITypes.Clash.PlayerDTO["position"]) {
	switch (position) {
		case "TOP":
			return 0;
		case "JUNGLE":
			return 1;
		case "MIDDLE":
			return 2;
		case "BOTTOM":
			return 3;
		case "UTILITY":
			return 4;
		case "FILL":
			return 5;
		case "UNSELECTED":
			return 6;
	}
}

export async function onClashCommand(interaction: any, env: Env) {
	const client = new RiotAPI(env.RIOT_API_KEY);

	let username = interaction.data.options[0].value;
	if (!username.includes("#")) {
		username += "#EUW";
	}
	// const region = (interaction.data.options[1]?.value as Regions) ?? Regions.EU_WEST;

	try {
		const [user, usertag] = username.split("#");
		const { team, players } = await getClashTeam(client, user, usertag);

		const orderedTeamPlayers = team.players.sort((a, b) => positionToNumber(a.position) - positionToNumber(b.position));

		return json({
			type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			data: {
				content: "",
				embeds: [
					{
						title: team.name,
						description: getPorofessorLink(orderedTeamPlayers.map((player) => players[player.summonerId])),
						fields: orderedTeamPlayers.map((player) => ({
							name: players[player.summonerId].gameName + (player.role !== "MEMBER" ? " (" + player.role.toLowerCase() + ")" : ""),
							value: player.position,
						})),
					},
				],
			},
		});
	} catch (e) {
		if (e instanceof Error) {
			console.error(e);
			return json({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: e.message,
					flags: InteractionResponseFlags.EPHEMERAL,
				},
			});
		} else {
			console.error(e);
			return json({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: "Unknown error",
					flags: InteractionResponseFlags.EPHEMERAL,
				},
			});
		}
	}
}
