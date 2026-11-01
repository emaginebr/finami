import logoUrl from "../../assets/logo.webp";
import { cn } from "../../utils/cn";

export interface LogoProps {
  /** Classe de altura da imagem (ex.: `h-8`, `h-14`) */
  className?: string;
  /** Classe do contêiner roxo que evita o retângulo visível sobre o fundo */
  containerClassName?: string;
}

/** Logo completa com o texto "Finami" (components.md §5), proporção 3:1 */
export const Logo = ({ className = "h-8", containerClassName }: LogoProps) => (
  <span
    className={cn(
      "inline-block overflow-hidden rounded-lg bg-brand leading-none",
      containerClassName,
    )}
  >
    <img src={logoUrl} alt="Finami" className={cn("block w-auto", className)} />
  </span>
);

export default Logo;
