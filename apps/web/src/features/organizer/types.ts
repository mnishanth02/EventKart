import type {
	OrganizerProfile,
	PolicyStatusResponse,
} from "@repo/shared/schemas";

export type { OrganizerProfile, PolicyStatusResponse };

export type OrganizerProfileResponse = {
	success: true;
	data: OrganizerProfile;
};

export type PolicyStatusApiResponse = {
	success: true;
	data: PolicyStatusResponse;
};
