const DEFAULT_VARIABLES = {
	query: "",
	limit: 300,
	page: 1,
	sort: {
		value: "popularity",
		order: "DESCENDING",
	},
	filter: {
		category: "TOP",
		exact_match: false,
		case_sensitive: false,
		ignore_tags: false,
		zero_width: false,
		animated: false,
		aspect_ratio: "",
	},
};
type QueryVariables = typeof DEFAULT_VARIABLES;

function query(page: number) {
	return {
		operationName: "SearchEmotes",
		query: `query SearchEmotes($query: String!, $page: Int, $sort: Sort, $limit: Int, $filter: EmoteSearchFilter) {
        emotes(query: $query, page: $page, sort: $sort, limit: $limit, filter: $filter) {
          items {
            id
            name
            animated
            host {
              files {
                format
              }
            }
          }
        }
      }`,
		variables: {
			...DEFAULT_VARIABLES,
			page: page + 1,
		},
	};
}

export type Emote = {
	id: string;
	name: string;
	animated: boolean;
	host: {
		files: {
			format: "AVIF" | "WEBP";
		}[];
	};
};

export async function getTopSevenGGEmotes() {
	return await Promise.all(
		Array.from({ length: 5 })
			.map((_, i) => query(i))
			.map((q) =>
				fetch("https://7tv.io/v3/gql", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(q),
				}).then((r) => r.json().then((r: any) => r.data.emotes.items))
			)
	).then((responses) => responses.flat());
}
