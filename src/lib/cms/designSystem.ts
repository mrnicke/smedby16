export const curatedDesignSystem = {
  palettes: ['smedby-grön','varm-neutral','hög-kontrast'] as const,
  typographyScales: ['kompakt','standard','luftig'] as const,
  spacing: ['compact','normal','spacious'] as const,
  containerWidths: ['normal','wide','full'] as const,
  buttonVariants: ['primary','secondary','text'] as const,
  sectionVariants: ['default','muted','accent','contrast'] as const,
  imageRatios: ['original','square','landscape','portrait','wide'] as const,
};
export type CuratedDesignSystem = typeof curatedDesignSystem;
