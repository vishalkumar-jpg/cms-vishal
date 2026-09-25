import * as React from "react";
import { Globe, PlugZap } from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PlugZap,
  Globe,
};

export const ConnectorIcon: React.FC<{ name: string; className?: string }> = ({
  name,
  className,
}) => {
  const Icon = ICONS[name] ?? PlugZap;
  return <Icon className={className} />;
};
