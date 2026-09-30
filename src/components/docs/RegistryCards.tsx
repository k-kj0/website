import type { RegistryCategory } from "@/data/registry-categories";
import { registryDocHref, type RegistryDoc } from "@/data/registry-docs";
import type { RegistryIconName } from "@/data/registry-icons";
import { RegistryIconTile } from "@/components/marketing/registry/RegistryIconTile";
import { canonicalizeInternalHref } from "@/lib/internalHref";

/**
 * One registry group as a card grid, on the Registry overview. Each card links
 * to the entry's section on the group's page.
 */
export function RegistryCards({
	productId,
	category,
	docs,
}: {
	productId: string;
	category: RegistryCategory;
	docs: RegistryDoc[];
}) {
	return (
		<div className="not-prose my-6 grid gap-4 sm:grid-cols-2">
			{docs.map((doc) => (
				<a
					key={doc.slug}
					href={canonicalizeInternalHref(registryDocHref(productId, category, doc))}
					className="group flex gap-4 rounded-lg border border-ink/10 bg-white/55 p-4 no-underline transition-colors hover:border-ink/25"
				>
					<RegistryIconTile
						title={doc.title}
						image={doc.image}
						icon={doc.icon as RegistryIconName | undefined}
						size={32}
						className="mt-0.5"
					/>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<span className="text-[15px] font-medium text-ink">{doc.title}</span>
							{doc.badge ? (
								<span className="shrink-0 rounded border border-ink/15 px-1.5 py-px text-[11px] font-medium leading-4 text-ink-faint">
									{doc.badge}
								</span>
							) : null}
						</div>
						<p className="mt-1 text-[13px] leading-snug text-ink-soft">{doc.description}</p>
					</div>
				</a>
			))}
		</div>
	);
}
