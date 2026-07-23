# @murihspace/brand

MurihSpace brand design tokens package.

## Status

⚠️ **Tokens are pending design approval.** Do not import this package into production applications until official brand colour values have been confirmed.

## Contents

- `src/tokens.css` — CSS custom properties (colour, typography, spacing)
- `src/index.ts` — TypeScript token name constants

## Usage (once approved)

```css
/* In a stylesheet */
@import "@murihspace/brand/tokens.css";
```

```ts
// In TypeScript
import { brandTokenNames } from "@murihspace/brand/tokens";
```

## TODO

- [ ] Obtain approved primary brand colour from design team
- [ ] Obtain approved secondary brand colour from design team
- [ ] Define full neutral palette
- [ ] Confirm brand typefaces (Geist, Inter, or custom)
- [ ] Define spacing scale
- [ ] Define shadow tokens
- [ ] Define border-radius tokens
- [ ] Import into dashboard and marketing after approval
