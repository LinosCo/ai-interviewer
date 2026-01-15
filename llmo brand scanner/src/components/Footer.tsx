import BrandSymbol from "./BrandSymbol";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-b from-background to-muted/30 border-t border-border py-12">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <BrandSymbol size="sm" />
          <span className="font-serif text-lg font-medium italic">Lino's</span>
          <span className="font-serif text-lg font-light">&</span>
          <span className="font-serif text-lg font-normal">co</span>
          <BrandSymbol size="sm" />
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto">
          © 2025 Lino's & co. Aiutiamo brand creativi ad essere scelti — anche dagli assistenti AI.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
