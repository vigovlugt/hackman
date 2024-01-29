export const commands = {
	e: {
		name: "e",
		description: "Send a emote",
		options: [
			{
				name: "emote",
				description: "The emote to send",
				type: 3,
				required: true,
			},
		],
	},
	clash: {
		name: "clash",
		description: "Lookup a clash team",
		options: [
			{
				name: "username",
				description: "Username + optional tag of person to look up",
				type: 3,
				required: true,
			},
			{
				name: "region",
				description: "Region of person to look up",
				type: 3,
				required: false,
			},
		],
	},
	update: {
		name: "update",
		description: "Update the commands and emotes",
	},
};
