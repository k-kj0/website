/**
 * The agentOS Registry's groups, in order. Each group is a docs page listing its
 * entries (see `src/pages/agentos/docs/registry/`) and a row in the Registry
 * sidebar fold. Also the marketing storefront's (`RegistryPageClient`) default
 * shelves. Kept apart from `registry.ts` so client islands can import it
 * without pulling in the whole catalog.
 */
export interface RegistryCategory {
	/** Matched against each entry's `types`. */
	type: string;
	label: string;
	description: string;
}

/**
 * The agentOS taxonomy. Agents have their own docs section and deploy targets
 * have Deploy, so neither is a registry group; entries only in those types get
 * no registry page.
 */
export const AGENTOS_REGISTRY_CATEGORIES: RegistryCategory[] = [
	{
		type: "file-system",
		label: "File Systems",
		description:
			"Mount these file systems as the root or at any sub-path inside the agent's environment.",
	},
	{
		type: "browser",
		label: "Browsers",
		description:
			"Let agents browse the web from inside the VM with cloud browser providers.",
	},
	{
		type: "sandbox-extension",
		label: "Sandbox Mounting",
		description:
			"agentOS is a hybrid OS. Mount sandbox file systems and interact with them via bindings for heavier workloads. Use agentOS natively for lightweight tasks.",
	},
	{
		type: "software",
		label: "Software",
		description:
			"Wasm command packages that run inside the agent's environment. Install individually or use meta-packages.",
	},
	{
		type: "binding",
		label: "Bindings",
		description:
			"Host-side bindings and integrations that extend agent capabilities.",
	},
];
