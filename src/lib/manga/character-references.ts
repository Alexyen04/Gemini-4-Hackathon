import {
  CharacterReference,
  ClipEventAnalysis,
  MonochromeUniformEncoding,
  NormalizedClip,
} from "@/types/manga";

export class CharacterReferenceService {
  /**
   * Builds consistent Story-wide CharacterReference records from Argon's
   * clip analyses and user-provided clip metadata, locking distinct monochrome
   * uniform encodings so opposing teams remain unmistakably distinct in B&W manga.
   */
  static buildCharacterReferences(
    clips: NormalizedClip[],
    analyses: ClipEventAnalysis[]
  ): CharacterReference[] {
    const clipMap = new Map(clips.map((c) => [c.clipId, c]));
    const teamList: string[] = [];

    for (const clip of clips) {
      if (clip.metadata.homeTeam && !teamList.includes(clip.metadata.homeTeam)) {
        teamList.push(clip.metadata.homeTeam);
      }
      if (clip.metadata.awayTeam && !teamList.includes(clip.metadata.awayTeam)) {
        teamList.push(clip.metadata.awayTeam);
      }
    }
    for (const analysis of analyses) {
      if (
        analysis.offensiveTeam &&
        !teamList.includes(analysis.offensiveTeam)
      ) {
        teamList.push(analysis.offensiveTeam);
      }
      if (
        analysis.defensiveTeam &&
        !teamList.includes(analysis.defensiveTeam)
      ) {
        teamList.push(analysis.defensiveTeam);
      }
    }

    const teamEncodingMap = new Map<string, MonochromeUniformEncoding>();
    teamList.forEach((team, idx) => {
      const mode: MonochromeUniformEncoding =
        idx === 0
          ? "light_ink_trim"
          : idx === 1
          ? "solid_ink"
          : "dark_halftone";
      teamEncodingMap.set(team.toLowerCase(), mode);
    });

    const charMap = new Map<string, CharacterReference>();

    for (const analysis of analyses) {
      const clip = clipMap.get(analysis.clipId) || clips[0];
      const bestMoment =
        analysis.bestMoments.find((m) => m.momentRole === "peak_action") ||
        analysis.bestMoments[0];
      const refFrame =
        clip.keyframes.find((f) => f.frameId === bestMoment?.nearestFrameId) ||
        clip.keyframes[Math.floor(clip.keyframes.length / 2)] ||
        clip.keyframes[0];

      for (const p of analysis.mainPlayers) {
        const teamName =
          p.team ||
          (p.role.startsWith("offense")
            ? analysis.offensiveTeam
            : analysis.defensiveTeam) ||
          clip.metadata.homeTeam ||
          "Court Squad";

        const cleanName = p.nameOrLabel
          .replace(/^#\d+\s*/, "")
          .trim()
          .toLowerCase();
        const normKey = p.jerseyNumber
          ? `${teamName.toLowerCase()}::#${p.jerseyNumber}`
          : `${teamName.toLowerCase()}::${cleanName || p.nameOrLabel.toLowerCase()}`;

        // Also check if an existing entry matches by canonical player name across clips
        let existingKey = normKey;
        let existing = charMap.get(normKey);
        if (!existing && cleanName && cleanName.length >= 3) {
          for (const [k, ref] of charMap.entries()) {
            const refClean = ref.displayName
              .replace(/^#\d+\s*/, "")
              .trim()
              .toLowerCase();
            if (
              refClean === cleanName ||
              (p.jerseyNumber &&
                ref.jerseyNumber === p.jerseyNumber &&
                ref.teamName.toLowerCase() === teamName.toLowerCase())
            ) {
              existingKey = k;
              existing = ref;
              break;
            }
          }
        }

        const detectedAccessories = Array.from(
          new Set([
            ...(existing?.accessories || []),
            ...(p.visualTraits.toLowerCase().includes("headband") ? ["headband"] : []),
            ...(p.visualTraits.toLowerCase().includes("sleeve") ? ["compression sleeve"] : []),
            ...(p.visualTraits.toLowerCase().includes("goggles") ? ["goggles"] : []),
          ])
        );

        if (existing) {
          // Merge richer traits/jersey number without creating duplicate character entries
          charMap.set(existingKey, {
            ...existing,
            jerseyNumber: existing.jerseyNumber || p.jerseyNumber,
            hairAndFaceTraits:
              p.visualTraits.length > existing.hairAndFaceTraits.length
                ? p.visualTraits
                : existing.hairAndFaceTraits,
            accessories: detectedAccessories,
            confidence: Math.max(existing.confidence, p.confidence),
          });
          continue;
        }

        const monochromeUniform =
          teamEncodingMap.get(teamName.toLowerCase()) ||
          (p.role === "defender" ? "solid_ink" : "light_ink_trim");

        const uniformDescription =
          monochromeUniform === "light_ink_trim"
            ? `Crisp paper-white jersey (${teamName}) with bold sumi-ink side trim and dark numerals`
            : monochromeUniform === "solid_ink"
            ? `Deep sumi-black road jersey (${teamName}) with stark white knockout numerals and light trim`
            : `55% angled halftone screentone jersey (${teamName}) with white-bordered numerals`;

        const slug = normKey
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "")
          .slice(0, 32);

        charMap.set(normKey, {
          characterId: `char_${slug || charMap.size + 1}`,
          displayName: p.nameOrLabel,
          jerseyNumber: p.jerseyNumber,
          teamName,
          monochromeUniform,
          uniformDescription,
          hairAndFaceTraits:
            p.visualTraits || "Athletic build, sharp competitive focus",
          buildAndPosture:
            p.role === "defender"
              ? "Long wingspan, low defensive stance, explosive vertical contest"
              : "Dynamic scorer silhouette, balanced elevation, crisp follow-through",
          accessories: detectedAccessories,
          shootingHand: "right",
          referenceClipId: clip.clipId,
          referenceFrameId: refFrame?.frameId || `${clip.clipId}_f01`,
          referenceImageUrl: refFrame?.mediaUrl || "",
          confidence: p.confidence,
        });
      }
    }

    // Ensure at least one reference exists even if clip had minimal player metadata
    if (charMap.size === 0 && clips.length > 0) {
      const firstClip = clips[0];
      const kf = firstClip.keyframes[0];
      charMap.set("default_protagonist", {
        characterId: "char_lead_player",
        displayName: firstClip.metadata.players[0] || "Primary Ballhandler",
        jerseyNumber: null,
        teamName: firstClip.metadata.homeTeam || "Home Team",
        monochromeUniform: "light_ink_trim",
        uniformDescription:
          "Crisp white manga jersey with clean black ink trim",
        hairAndFaceTraits: "Athletic silhouette grounded in source footage",
        buildAndPosture: "Explosive basketball posture",
        accessories: [],
        shootingHand: "right",
        referenceClipId: firstClip.clipId,
        referenceFrameId: kf?.frameId || "frame_01",
        referenceImageUrl: kf?.mediaUrl || "",
        confidence: 0.7,
      });
    }

    return Array.from(charMap.values());
  }
}
