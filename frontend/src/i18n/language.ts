export type AppLanguage = "es" | "en";

export function getLanguageFromPathname(pathname: string): AppLanguage {
  const language = pathname.split("/")[1];

  if (language === "en") {
    return "en";
  }

  return "es";
}

export function replaceLanguageInPathname(
  pathname: string,
  newLanguage: AppLanguage
): string {
  const pathParts = pathname.split("/");

  if (pathParts[1] === "es" || pathParts[1] === "en") {
    pathParts[1] = newLanguage;
  } else {
    pathParts.splice(1, 0, newLanguage);
  }

  return pathParts.join("/");
}
