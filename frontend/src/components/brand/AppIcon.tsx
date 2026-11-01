// WebP de 288 px (96 px × 3) gerado por scripts/generate-icons.mjs — 6 KB em vez de 176 KB
import appIconUrl from "../../assets/app-icon.webp";
import { cn } from "../../utils/cn";

import { AppIconSize } from "../ui/variants";

const SIZE_PX: Record<AppIconSize, number> = {
  [AppIconSize.Sm]: 32,
  [AppIconSize.Md]: 64,
  [AppIconSize.Lg]: 96,
};

export interface AppIconProps {
  size?: AppIconSize | `${AppIconSize}`;
  /** `""` quando ao lado do texto "Finami" (decorativo); `"Finami"` quando sozinho */
  alt?: string;
  className?: string;
}

/** Ícone do app com cantos de squircle (`border-radius: 22.37%`) */
export const AppIcon = ({ size = AppIconSize.Md, alt = "", className }: AppIconProps) => {
  const px = SIZE_PX[size as AppIconSize];
  return (
    <img
      src={appIconUrl}
      alt={alt}
      width={px}
      height={px}
      className={cn("block rounded-icon shadow-[0_8px_24px_rgb(0_0_0/0.35)]", className)}
    />
  );
};

export default AppIcon;
