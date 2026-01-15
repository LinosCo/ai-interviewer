import { Sparkles } from "lucide-react";

interface BrandSymbolProps {
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
}

const BrandSymbol = ({ size = "md", animated = true, className = "" }: BrandSymbolProps) => {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-6 h-6",
  };

  const baseClasses = `text-creative ${sizeClasses[size]}`;
  const animationClasses = animated ? "animate-pulse-glow" : "";

  return (
    <Sparkles className={`${baseClasses} ${animationClasses} ${className}`} />
  );
};

export default BrandSymbol;
