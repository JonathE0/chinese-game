# Metro redesign: Qinghe–Yunhai

Status: user approved the metro design with the no-emergency-return correction. User confirmed one operating route; other lines are future expansion only. Business-income deployment is outside this work.

## Player experience
Replace the outside ticket seller with a free rechargeable transit card, station top-up machines and entry/exit gates. Keep beginner instructions in English with Mandarin labels and optional pronunciation/help. Top-ups transfer coins from the wallet to the card; they never create money.

The first release operates only Qinghe–Yunhai, in both directions. Display a proposed 5-coin fare each way before entering. Store route distance and fare bands as content so future shorter and longer routes can have different prices. Do not invent selectable destinations to demonstrate different fares now.

Reserve the displayed fare when entering the paid area. Leaving the origin without travelling cancels the reservation. Complete one charge at arrival, including skipped rides; exiting the destination must not charge again. Prevent entry without sufficient available card balance. No emergency or free return travel. If funds are insufficient, explain that players can study to earn coins and then top up their card. Keep independent study accessible at both stations.

Migrate unused tickets into card credit at their original purchase value. Honour existing unexpired passes until their saved expiry; stop selling new passes. Preserve travel counts and listening rewards. Persist journey identity and payment state so reloading cannot duplicate charges or strand the player mid-journey.

## Stations and references
Keep the cute low-poly art style. Qinghe's underground platform uses tiled floors, ceiling slats, columns, overhead bilingual signs, line maps, glass platform doors and boarding markings. Avoid reproducing unrelated real-world station names or branding.

Yunhai Central is a much larger destination station: a high central hall, decorative ring lighting, multiple colour-coded line entrances, gates and a generous operational platform. Future-line entrances are visible but closed and labelled Coming later; they have no active destination buttons, fare deductions or misleading departure displays. Allow space in the layout for future expansion without building unused route simulations.

Original user references, retained at full resolution:
- [Wide underground platform](../../references/metro/underground-platform-wide.png)
- [Platform signage and markings](../../references/metro/underground-platform-signage.png)
- [Decorative platform lighting](../../references/metro/underground-platform-lighting.png)

References are planning assets, not runtime textures. Their underground platform details guide both stations; the grand Yunhai concourse is an additional design requirement.

## Trains and journeys
Animate a train arriving, stopping, opening doors, closing doors and departing. Synchronise train doors with platform doors. Players board by walking through an open doorway into the carriage; proximity or interacting with a sign must not automatically board them.

Use a short scenic ride with Mandarin announcements and a Skip to arrival control. Offer a saved Always fade after boarding preference. Both options start only after physical boarding and produce the same fare and arrival. Do not simulate the entire geographic distance between separate world scenes; use a contained moving carriage scene with passing scenery. On arrival, open doors and let the player walk onto Yunhai's platform, then through the concourse to the existing city. The return follows the same flow.

Hold departure briefly if the player occupies a doorway, then safely keep them on the platform or fully aboard; never trap them inside closing geometry. Platform barriers prevent track access. Recover interrupted journeys at a safe station/carriage state with a single payment outcome. Keep announcements replayable and existing listening practice optional; skipping must not award an unanswered listening reward.

## Implementation boundaries
Reuse current metro content, profile saving, wallet, announcements, world construction and UI patterns. Separate pure card/fare/journey rules from presentation. Describe stations and future-line placeholders in editable content. Build only one operational line and one shared train system, with station-specific layouts. Preserve existing access to Yunhai activities and the return to Qinghe.

## Delivery stages
1. Transit card, fare content, old-save migration and recoverable journey state.
2. Qinghe platform rebuild, gates, top-ups and physical train boarding.
3. Ride/fade/skip flow and safe arrival/return.
4. Grand Yunhai Central with clearly inactive future-line spaces.
5. Visual playthrough, collision/accessibility checks and relevant automated regression tests.

## Acceptance
- No outside ticket-selling NPC remains; top-up and travel work in both directions.
- Only Qinghe–Yunhai is operational; placeholders cannot charge or transport players.
- Coin/card totals remain correct across top-ups, cancellation, boarding, skip, arrival and reload.
- Existing tickets/passes retain their value or validity after migration.
- Boarding requires entering through open doors; players can safely board and alight.
- Normal and skipped travel arrive at the same platform without duplicate fares/rewards.
- Both stations visibly follow the references; Yunhai feels substantially larger.
- City activities, save/load, beginner guidance and browser performance remain usable.

## Accepted defaults
Five coins each way, short scenic rides with optional skip and an always-fade setting. No emergency return, as explicitly requested.

## Added HUD reminder
Show a small exclamation badge above the Condition shortcut whenever hunger or rest is in the existing low/critical band. Follow the configured key, not a hard-coded 4. Describe the affected need in accessible text, update after eating/sleeping and clear only when neither need is low. No repeated pop-up or flashing.
