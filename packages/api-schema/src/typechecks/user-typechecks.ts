import {
  type CreateUserRequest,
  type CreateUserResponse,
  createUserRequestSchema,
  createUserResponseSchema,
  type GetUserRequest,
  type GetUserResponse,
  getUserRequestSchema,
  getUserResponseSchema,
  type ListUsersRequest,
  type ListUsersResponse,
  listUsersRequestSchema,
  listUsersResponseSchema,
} from "../schema/user-schema";
import { matchesSchema } from "./typecheck";

export function isGetUserRequest(data: unknown): data is GetUserRequest {
  return matchesSchema(getUserRequestSchema, data);
}

export function isGetUserResponse(data: unknown): data is GetUserResponse {
  return matchesSchema(getUserResponseSchema, data);
}

export function isListUsersRequest(data: unknown): data is ListUsersRequest {
  return matchesSchema(listUsersRequestSchema, data);
}

export function isListUsersResponse(data: unknown): data is ListUsersResponse {
  return matchesSchema(listUsersResponseSchema, data);
}

export function isCreateUserRequest(data: unknown): data is CreateUserRequest {
  return matchesSchema(createUserRequestSchema, data);
}

export function isCreateUserResponse(data: unknown): data is CreateUserResponse {
  return matchesSchema(createUserResponseSchema, data);
}
