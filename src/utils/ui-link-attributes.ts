import { encodeMailto, MAILTO_ONCLICK_SCRIPT } from "@/utils/email-utils";
import { getUiContent } from "@/utils/ui-visibility";
import { url } from "@/utils/url-utils";

export function getUiLinkAttributes(
	id: string,
	baseUrl: string,
	baseName: string,
	urlField = "url",
	nameField = "name",
	baseExternal = false,
	relBase = "",
): Record<string, string | undefined> {
	const address = getUiContent(id, urlField, baseUrl).replace(
		/^(?:https?|mailto):/i,
		(protocol) => protocol.toLowerCase(),
	);
	const name = getUiContent(id, nameField, baseName);
	const mailto = address.startsWith("mailto:");
	const external =
		!mailto &&
		(/^https?:/.test(address) || (address === baseUrl && baseExternal));
	return {
		href: mailto ? "#" : address.startsWith("#") ? address : url(address),
		"aria-label": name,
		title: name,
		target: external ? "_blank" : undefined,
		rel:
			[relBase, external ? "noopener noreferrer" : ""]
				.filter(Boolean)
				.join(" ") || undefined,
		"data-encoded-email": mailto ? encodeMailto(address) : undefined,
		onclick: mailto ? MAILTO_ONCLICK_SCRIPT : undefined,
		"data-ui-url-field": urlField,
		"data-ui-name-field": nameField,
		"data-nav-href":
			!mailto && !external && !address.startsWith("#")
				? url(address)
				: undefined,
	};
}
