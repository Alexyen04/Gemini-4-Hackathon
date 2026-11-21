# Sports Manga Narrative Pacing & Beat Decomposition

## 1. Five-Stage Story Structure
Gemini 4 Carbon's `NarrativePlanner` must organize the uploaded clips into a unified five-stage sports manga arc:

1. **`introduction` (Stakes & Arena Atmosphere)**:
   - Establish competing teams, key athletes, game score/quarter context, and tension.
2. **`rising_action` (Momentum Exchange)**:
   - Showcase early explosive plays (dunks, deep threes, crisp ball movement) demonstrating both teams' strengths.
3. **`conflict` (Adversity & Defensive Pressure)**:
   - Highlight momentum swings, crucial blocks, turnovers, fourth-quarter pressure, or trailing deficits.
4. **`climax` (The Decisive Possession)**:
   - Decompose the highest-stakes clip into multiple sequential beats so time slows down (*manga time dilation*) right before the decisive make or stop.
5. **`resolution` (Aftermath & Emotional Resonance)**:
   - Reveal the verified outcome, scoreboard finality, and contrasting triumph/exhaustion reactions.

## 2. Time Dilation & Clip-to-Panel Beat Decomposition
Never compress an entire 5-clip game into 5 flat single-panel screenshots. Instead, allocate panel budgets proportional to `narrative_significance`:

- **Standard Highlight (`significance: medium`)** → **2 panels**:
  - Beat A (`timestamp: t_setup`): Ball-handler initiating move / screen / gather (`medium_shot` or `closeup`).
  - Beat B (`timestamp: t_peak`): Peak finish at the rim or release (`low_angle` or `dynamic_action`).
- **Climax Highlight (`significance: climax`)** → **3 to 5 panels**:
  - Beat 1 (`establishing`): Arena tension / clock / wide alignment.
  - Beat 2 (`anticipation`): Extreme closeup on eyes, sweat, or fingers on leather seams.
  - Beat 3 (`movement`): Separation move or airborne elevation against defender.
  - Beat 4 (`climax`): Full-width or splash impact of the decisive basket or block.
  - Beat 5 (`aftermath`): Net snap, buzzer, or player celebration.

All timestamps MUST lie strictly within `[0, clip.duration]` of the referenced `source_clip_id`.
