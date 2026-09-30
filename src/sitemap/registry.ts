import type { RegistryCategory } from "@/data/registry-categories";

/** Href of a product's registry, a section of its Documentation tab. */
export function registryHref(productId: string, slug = ""): string {
	const base = `/${productId}/docs/registry`;
	return slug ? `${base}/${slug}/` : `${base}/`;
}

/** URL segment of a registry group's page, e.g. "Sandbox Mounting" -> `sandbox-mounting`. */
export function registryCategorySlug(category: RegistryCategory): string {
	return category.label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

/** Href of a registry group's page, which lists that group's entries. */
export function registryCategoryHref(productId: string, category: RegistryCategory): string {
	return registryHref(productId, registryCategorySlug(category));
}
