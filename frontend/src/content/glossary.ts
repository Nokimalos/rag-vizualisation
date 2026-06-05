export const GLOSSARY_TERMS = ['chunking', 'embedding', 'retrieval', 'generation'] as const
export type GlossaryTerm = (typeof GLOSSARY_TERMS)[number]
