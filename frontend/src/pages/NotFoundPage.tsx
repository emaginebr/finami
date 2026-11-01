import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppIcon } from "../components/brand/AppIcon";

/** Página não encontrada (rota `*`) */
const NotFoundPage = () => {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-dvh place-items-center px-gutter pt-safe pb-safe">
      <div className="flex max-w-auth flex-col items-center gap-3 text-center">
        <AppIcon size="lg" />
        <h1 className="m-0 mt-2 font-display text-title-2">{t("notFound.title")}</h1>
        <p className="m-0 text-subhead text-text-muted">{t("notFound.description")}</p>
        <Link
          to="/"
          className="mt-3 inline-flex min-h-12 items-center rounded-md bg-accent px-5 text-headline text-on-accent no-underline hover:bg-accent-hover"
        >
          {t("notFound.goHome")}
        </Link>
      </div>
    </main>
  );
};

export default NotFoundPage;
