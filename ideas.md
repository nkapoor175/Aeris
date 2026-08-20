# AERIS cinematic landing — design direction

## Three possible directions

### Theme Name: Clinical Darkroom
Very dark editorial medical photography with restrained instrumentation, warm gold optics, and sparse biological red. It treats the page like a product film in a research lab.

**Probability:** 0.067

### Theme Name: Signal Atlas
A light, paper-like scientific atlas with ink-black diagrams, red biological traces, and tactile annotation. It would feel archival, precise, and educational.

**Probability:** 0.031

### Theme Name: Flow State
A fluid, near-black biological environment where cells, light, and signal continuously reorganize into one visual system. It prioritizes movement and atmosphere over conventional sections.

**Probability:** 0.083

## Selected approach: Clinical Darkroom

### Design Movement
Contemporary cinematic editorialism with clinical photography, scientific instrumentation, and restrained post-digital precision.

### Core Principles
1. Let motion explain the product: every scene causes the next, rather than appearing as a stack of unrelated sections.
2. Use negative space as a clinical instrument: copy is sparse, deliberate, and anchored to the edges.
3. Keep material language believable: monochrome photography, soft volumetric biology, warm optical gold, and deep red only where blood is the subject.
4. Reveal complexity progressively: clinical image → bloodstream → sensor → signal → classification.

### Color Philosophy
The base is near-black because the story moves from a darkroom-like clinical world into the hidden interior of the body. Cool off-white typography keeps the interface precise, muted warm gold identifies AERIS optics and the signal layer, while deep red is reserved for biological evidence. Gold is never used as a generic accent; it means measurement.

### Layout Paradigm
Use a pinned camera stage with asymmetrical edge annotations. Long scroll chapters move the visual stage while text locks to the left or right margin. The final console is an architectural consequence of the waveform, not a standard dashboard grid.

### Signature Elements
- A square/rectangular cursor aperture that reveals the color image beneath the grayscale hero.
- Thin gold optical rules and small monospace annotations that drift with the camera.
- RBC streams that move from right to left, compress into an orbit, and resolve into a sensor pulse.

### Interaction Philosophy
Interactions should feel like controlled scientific instruments: subtle, responsive, and measurable. Hover states expose hidden information rather than decorating the surface. Scroll is the primary input and should always feel like advancing a camera through one environment.

### Animation
Use long, eased transforms for scene travel and short, interruptible transitions for hover states. RBCs move on explicit curved paths with depth-based opacity; waveform drawing uses scale/clip progression; final cards emerge from linework. All non-essential animation pauses under `prefers-reduced-motion`.

### Typography System
Use Space Grotesk for display typography and IBM Plex Mono for technical metadata. Display type is uppercase, wide-tracked, and used in a few large moments. Mono labels stay small, quiet, and aligned to axes or measurement lines.

### Brand Essence
AERIS is a non-invasive optical screening story for clinical teams who need an earlier signal, told through one calm fingertip measurement instead of a needle. **Precise. Quiet. Investigative.**

### Brand Voice
Headlines are compact and declarative. CTAs are invitations into the instrument, never hype. Microcopy reads like a lab note with human restraint.

Example lines:
- “The signal is already there.”
- “Enter the screening console →”

### Wordmark & Logo
Use a compact three-arc aperture mark with a central blood-cell depression. The symbol should appear before the AERIS wordmark and work independently as a favicon.

### Signature Brand Color
**Optical Gold — #C6A56A.** A muted, instrument-like gold that signals measurement without drifting into luxury or neon.

## Specification lock: visual system and component structure

The design direction remains **Clinical Darkroom** and is not being replaced. The page will use a near-black cinematic field, warm off-white typography, Optical Gold `#C6A56A` for measurement/interface language, and deep crimson only for literal blood evidence. The hero remains the supplied grayscale fingertip photograph with a localized rectangular color aperture on hover. No full-image color transition, neon treatment, decorative 3D blobs, generic SaaS cards, or extra marketing sections will be introduced.

The experience is organized as one pinned camera journey with six restrained scenes: `HeroScene`, `BiologyScene`, `OpticalSensingScene`, `ClassificationScene`, `MethodScene`, and `FinalCtaScene`. The shared primitives are `AerisHeader`, `TechnicalLabel`, `OpticalRule`, `FilmGrain`, `SceneProgressRail`, `DiscCell`, `OpticalBeam`, `SignalTrace`, and `EditorialPrinciples`. The only full-screen scene backgrounds are the supplied hero photograph, realistic disc-shaped erythrocyte field, fingertip/tissue sensing treatment, and signal/classification linework.

The biology scene has one visual rule: erythrocytes must read as realistic biconcave discs with a visible depression, varied orientation, soft volumetric shading, and believable depth. The first biology state will not use generic animated particles. If motion is used later in the sequence, it will be slow fluid drift of those same disc cells, not a separate particle system. The provided RBC flow reference is used as the directional cue for right-to-left camera movement and concentration toward the fingertip sensing scene.

The optical sensing scene follows a scientific four-step visual grammar: fingertip contact, 660 nm red illumination, 880 nm infrared illumination, and returning optical signal. Beams stay thin and restrained, terminate in the tissue, and resolve into the waveform rather than becoming a laser-show effect.

The scroll choreography is progressive rather than sectional: the hero darkens and scales inward; biological discs emerge; the flow compresses toward the fingertip; red and infrared paths appear; returning signal lines remain after the biology recedes; classification linework resolves; then the system simplifies into the method and final CTA. Mobile keeps the same order and meaning, reducing density rather than adding alternate content.
