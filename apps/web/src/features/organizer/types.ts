import type { OrganizerProfile } from "@repo/shared/schemas";

export type { OrganizerProfile };

export type OrganizerProfileResponse = {
	success: true;
	data: OrganizerProfile;
};
