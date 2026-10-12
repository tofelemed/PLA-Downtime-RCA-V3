import type { ErrorMessage } from './error-message';

/** Users, scope grants, tasks and plant configuration (v2 administration API). */
export const ADMINISTRATION_MESSAGES: Readonly<Record<string, ErrorMessage>> = {
  EMAIL_EXISTS: { title: 'A user with this e-mail already exists', text: 'Use a different e-mail address.' },
  CANNOT_DEACTIVATE_SELF: { title: 'You cannot deactivate your own account' },
  CANNOT_DELETE_SELF: { title: 'You cannot delete your own account' },
  SELF_GRANT_NOT_ALLOWED: {
    title: 'You cannot change your own access',
    text: 'Another administrator has to grant or remove it (separation of duties).',
  },
  HOME_SCOPE_REQUIRED: {
    title: 'This access comes from the user’s role',
    text: 'Change the role in the user’s details instead.',
  },
  USER_INACTIVE: { title: 'This user is deactivated', text: 'Activate the user before granting access.' },
  SCOPE_EXISTS: { title: 'The user already has this access here' },
  INVALID_ASSIGNEE: { title: 'This person cannot be assigned', text: 'Choose an active member of this plant.' },
  ATTRIBUTE_EXISTS: { title: 'An attribute with this name already exists', text: 'Use a different internal name.' },
  ATTRIBUTE_NOT_EDITABLE: {
    title: 'This attribute is shared with other plants',
    text: 'Only a super administrator can change it.',
  },
  ORGANIZATION_HAS_PLANTS: { title: 'This organization still has plants', text: 'Delete or move its plants first.' },
  PLANT_IN_USE: {
    title: 'This plant cannot be deleted',
    text: 'It still has units or users, or it is the plant you are working in.',
  },
};
