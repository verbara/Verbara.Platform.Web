/**
 * GENERATED FILE — do not hand-edit.
 *
 * Produced by `npm run generate:api-types` (openapi-typescript) from
 * Platform's exported OpenAPI document. Regenerate after any Platform API
 * change; see openspec/changes/archive/2026-07-12-openapi-typed-client/ for the
 * mechanism and design.md for the committed-file-not-CI-fetch decision. Living
 * spec: openspec/specs/openapi-generated-types/spec.md. Next-phase follow-up
 * (remaining hook migration, numeric-coercion helper):
 * openspec/changes/openapi-typed-client-phase2/.
 */
export interface paths {
  '/api/v{version}/auth/login': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['LoginRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/refresh': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/login/apikey': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ApiKeyLoginRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/forgot-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ForgotPasswordRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/reset-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ResetPasswordRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/mfa/verify': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['MfaVerifyRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/logout': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/change-password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ChangePasswordRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/mfa/setup': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/mfa/confirm': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['MfaConfirmRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/mfa': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['MfaDisableRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/mfa/recovery-codes/regenerate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['RegenerateRecoveryCodesRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/sessions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/sessions/{tokenId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          tokenId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/sessions/revoke-others': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/password-policy': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/profile/security/mfa/enroll/init': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Step 1 — generate a fresh TOTP secret + QR URI. Nothing is committed
     *     to the user record yet; the caller must replay the secret in step 2.
     */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/profile/security/mfa/enroll/verify': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Step 2 — validate the TOTP against the supplied secret; on success,
     *     persist the secret + freshly-minted recovery codes and return the
     *     plaintext codes one time.
     */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['MfaEnrollVerifyRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/profile/security/mfa/enroll/complete': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Step 3 — finalise enrollment after the user acknowledges saving the
     *     recovery codes. Idempotent: replays return 200 with no side effect.
     */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['MfaEnrollCompleteRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/profile/security/sessions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/profile/security/sessions/{tokenId}/revoke': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          tokenId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/profile/security/recovery-codes/regenerate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * Regenerates the user's recovery codes after a fresh TOTP step-up.
     *     Returns the plaintext codes ONCE; stores SHA-256 + per-user salt hashes.
     */
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ProfileRegenerateRecoveryCodesRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webhooks/{tenantId}/{channel}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          tenantId: string;
          channel: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webhooks/{tenantId}/whatsapp': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          'hub.mode'?: string;
          'hub.verify_token'?: string;
          'hub.challenge'?: string;
        };
        header?: never;
        path: {
          tenantId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webhooks/{tenantId}/messenger': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          'hub.mode'?: string;
          'hub.verify_token'?: string;
          'hub.challenge'?: string;
        };
        header?: never;
        path: {
          tenantId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webhooks/{tenantId}/instagram': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          'hub.mode'?: string;
          'hub.verify_token'?: string;
          'hub.challenge'?: string;
        };
        header?: never;
        path: {
          tenantId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          state?: components['schemas']['ConversationState'];
          queueId?: string;
          agentId?: string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfConversation'];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateConversationRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['Conversation'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}/messages': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          limit?: number | string;
          offset?: number | string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['Message'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['SendMessageRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['Message'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}/accept': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['OwnershipResult'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}/reject': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['OwnershipResult'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}/transfer': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['TransferRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['OwnershipResult'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}/close': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['Conversation'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}/typification-form': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TypificationFormResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}/typify': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['TypifyRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TypificationSubmission'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TypifyErrorResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}/typification-suggestion': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TypificationSuggestionResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}/hold': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['OwnershipResult'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}/unhold': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['OwnershipResult'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}/typification-correction': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['TypificationCorrectionRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TypificationCorrectionResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/conversations/{id}/voice-transfer': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['VoiceTransferRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['VoiceTransferResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['VoiceTransferResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/voice/dial': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['VoiceDialRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['VoiceDialResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['VoiceDialResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/agents/me': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentMeResponseDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/agents/me/state': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateAgentStateRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentMeResponseDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/agents/me/pause/cancel': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentMeResponseDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/agents/me/pause/force': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentMeResponseDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/agents/me/heartbeat': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/agents/me/offline': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/users': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          page?: number | string;
          pageSize?: number | string;
          email?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfUserDto'];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateUserRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/users/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['UserDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateUserRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['UserDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/queues': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfQueueDto'];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateQueueRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/queues/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['QueueDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateQueueRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['QueueDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/queue-members': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['AddQueueMemberRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/queue-members/{queueId}/{agentId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          queueId: string;
          agentId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/agents': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfAdminAgentResponseDto'];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateAgentRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/agents/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AdminAgentResponseDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateAgentRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AdminAgentResponseDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': string;
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/agents/{id}/queue-memberships': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentQueueMembershipDto'][];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/agents/{id}/force-offline': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ForceAgentOfflineRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/teams': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfTeamDto'];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateTeamRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/teams/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TeamDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateTeamRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TeamDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/queues/{queueId}/members': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          queueId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['QueueMemberDto'][];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          queueId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['AddMemberBody'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/queues/{queueId}/members/{agentId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          queueId: string;
          agentId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          queueId: string;
          agentId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateMemberBody'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['QueueMemberDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': string;
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    trace?: never;
  };
  '/api/v{version}/queues/{queueId}/members/{agentId}/pause': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          queueId: string;
          agentId: string;
        };
        cookie?: never;
      };
      requestBody?: {
        content: {
          'application/json': null | components['schemas']['PauseMemberBody'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PauseResultDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/queues/{queueId}/members/{agentId}/resume': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          queueId: string;
          agentId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PauseResultDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/flows': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateFlowRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/flows/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateFlowRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/flows/{id}/publish': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/channels': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/channels/{channel}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          channel: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          channel: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateChannelConfigRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TenantChannelConfig'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': string;
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/channels/{channel}/test': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          channel: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ChannelTestResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': string;
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/contacts/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['Contact'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateContactRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['Contact'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/contacts/{id}/conversations': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfConversation'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/contacts': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          search?: string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfContact'];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateContactRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/setup': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['SetupRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/events/stream': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/users/me': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/canned-responses': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          q?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CannedResponseDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          parentId?: string;
          status?: string;
          type?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MgmtTenantDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateMgmtTenantRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MgmtTenantDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateMgmtTenantRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MgmtTenantDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{id}/suspend': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['StatusUpdateResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{id}/activate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['StatusUpdateResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/system/info': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SystemInfoDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/system/license': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['LicenseInfoDto'];
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateLicenseRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MessageResponse'];
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/system/license/status': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['LicenseStatusSnapshot'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/system/settings': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SystemSettingsDto'];
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['SystemSettingsRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SystemSettingsDto'];
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/cluster/status': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MgmtClusterStatusDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/cluster/nodes': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateNodeRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/cluster/nodes/{nodeId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          nodeId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MgmtClusterNodeDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          nodeId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateNodeRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          nodeId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/cluster/nodes/{nodeId}/drain': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          nodeId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['MgmtDrainNodeRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          nodeId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['StatusUpdateResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/cluster/nodes/{nodeId}/force-drain': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          nodeId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['StatusUpdateResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/cluster/instances': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/api-keys': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MgmtApiKeyDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateMgmtApiKeyRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/api-keys/{id}/rotate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CreateMgmtApiKeyResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/api-keys/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/features/agent-assist': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentAssistFeatureDto'];
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['AgentAssistFeatureUpdateRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentAssistFeatureDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/problem+json': components['schemas']['HttpValidationProblemDetails'];
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/media/upload': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/media/{id}/download': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfCampaignSummaryDto'];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateCampaignRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CampaignDetailDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateCampaignRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CampaignDetailDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}/start': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}/pause': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}/resume': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}/stop': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}/contact-lists': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ContactListDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateContactListRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}/contact-lists/{listId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
          listId: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}/contact-lists/{listId}/import': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
          listId: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ImportContactsRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ImportResultDto'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}/contact-lists/{listId}/contacts': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path: {
          id: number;
          listId: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}/dispositions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DispositionCodeDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateDispositionCodeRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}/dispositions/{codeId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
          codeId: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateDispositionCodeRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DispositionCodeDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
          codeId: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}/callbacks': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CallbackDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateCallbackRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/campaigns/{id}/metrics': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CampaignMetricsDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/operations/campaigns/metrics': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CampaignMetricsDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/call-attempts/{id}/disposition': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateCallAttemptDispositionRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/dnc-lists': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DncListDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateDncListRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/dnc-lists/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DncListDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateDncListRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DncListDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/dnc-lists/{id}/entries': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          offset?: number | string;
          limit?: number | string;
        };
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DncEntryDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['AddDncEntryRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/dnc-lists/{id}/entries/{phone}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
          phone: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/dnc-lists/{id}/import': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DncImportResultDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': string;
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/dnc-lists/{id}/check/{phone}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
          phone: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DncCheckResultDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/caller-id-pools': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CallerIdPoolDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateCallerIdPoolRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/caller-id-pools/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CallerIdPoolDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateCallerIdPoolRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CallerIdPoolDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/caller-id-pools/{id}/entries': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CallerIdEntryDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['AddCallerIdEntryRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/caller-id-pools/{id}/entries/{entryId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
          entryId: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/holiday-calendars': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['HolidayCalendarDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateHolidayCalendarRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/holiday-calendars/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['HolidayCalendarDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateHolidayCalendarRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['HolidayCalendarDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/holiday-calendars/{id}/holidays': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['HolidayDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['AddHolidayRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/holiday-calendars/{id}/holidays/{holidayId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
          holidayId: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/dialer/settings': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateDialerSettingsRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/trunks': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateTrunkRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/trunks/active': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/trunks/by-name/{name}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          name: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/trunks/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateTrunkRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/trunks/{id}/test-connectivity': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/voice/codecs': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['VoiceCodecsResponse'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/did-routes': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DidRouteDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateDidRouteRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/did-routes/active': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DidRouteDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/did-routes/by-did/{did}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          did: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DidRouteDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/did-routes/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DidRouteDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateDidRouteRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DidRouteDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Conflict */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/routes': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['OutboundRouteDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateOutboundRouteRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/routes/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['OutboundRouteDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateOutboundRouteRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['OutboundRouteDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/routes/reorder': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': (number | string)[];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/recordings/{sessionId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          sessionId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['RecordingMetadataDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/recordings/{sessionId}/stream': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          sessionId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/dashboard': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          to?: string;
          queue?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DashboardDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/cdr': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          to?: string;
          queue?: string;
          agent?: string;
          channel?: string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedDataResponseOfCdrRowDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/cdr/{sessionId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          sessionId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CdrDetailDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/qa': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          to?: string;
          minScore?: number | string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedDataResponseOfQaRowDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/qa/{sessionId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          sessionId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['QaDetailDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/intervals/agents': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          to?: string;
          agentId?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentIntervalDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/intervals': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          to?: string;
          queue?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['IntervalDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/bot': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          to?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/call-analytics/topics/trends': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          to?: string;
          topN?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TopicTrendsResponse'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/call-analytics/sentiment/trends': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          to?: string;
          bucket?: string;
          queueName?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SentimentTrendsResponse'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/call-analytics/compliance/summary': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          to?: string;
          queueName?: string;
          severity?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ComplianceSummaryResponse'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/live': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['LiveStateDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/live/{queueName}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          queueName: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['LiveStateDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/current-interval': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          queueName?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CurrentIntervalDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/operations/queue-metrics': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['QueueMetricsDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/bots': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['BotDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateBotRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/bots/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['BotDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateBotRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['BotDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/articles': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ArticleDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateArticleRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/articles/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateArticleRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ArticleDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/knowledge/search': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          q: string;
          limit?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/agent-assist/sessions/{sessionId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          sessionId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentAssistSessionDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/agent-assist/sessions/{sessionId}/suggestions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          sessionId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SuggestionLogRowDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/agent-assist/sessions/{sessionId}/compliance': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          sessionId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ComplianceAlertRowDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/agent-assist/config': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentAssistConfigSnapshot'];
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['AgentAssistConfigSnapshot'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentAssistConfigSnapshot'];
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/agent-assist/keyword-rules': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['KeywordRuleDto'][];
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['KeywordRuleDto'][];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['KeywordRuleDto'][];
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/agent-assist/compliance-rules': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ComplianceRuleDto'][];
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ComplianceRuleDto'][];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ComplianceRuleDto'][];
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/supervisor/sessions/active': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ActiveSessionDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/supervisor/sessions/{sessionId}/whisper': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          sessionId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['WhisperRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/supervisor/sessions/{sessionId}/listen': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          sessionId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ListenRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ListenEntry'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/supervisor/conversations': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          queue?: string;
          agent?: string;
          channel?: string;
          state?: string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfConversation'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/supervisor/conversations/{id}/messages': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          limit?: number | string;
          offset?: number | string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['Message'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/supervisor/conversations/{id}/takeover': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['OwnershipResult'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/supervisor/conversations/{id}/close': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['SupervisorCloseRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MessageResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/supervisor/conversations/{id}/note': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CoachingNoteRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MessageResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/supervisor/conversations/stuck': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['StuckConversationDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/supervisor/conversations/{id}/reassign': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ReassignConversationRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/supervisor/conversations/{id}/retry-callback': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/skills': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SkillDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateSkillRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/skills/{name}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          name: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpsertSkillRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SkillDto'];
          };
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: {
          force?: boolean;
        };
        header?: never;
        path: {
          name: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/skills/{name}/agents': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          name: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentSkillDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/agents/{agentId}/skills': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          agentId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AgentSkillDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          agentId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['AssignSkillRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/agents/{agentId}/skills/{skillName}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          agentId: string;
          skillName: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/audit': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          action?: string;
          entityType?: string;
          performedBy?: string;
          from?: string;
          to?: string;
          category?: string;
          severity?: string;
          actorId?: string;
          targetId?: string;
          targetType?: string;
          correlationId?: string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/audit/{entityType}/{entityId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          entityType: string;
          entityId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/audit/events': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          actionPrefix?: string;
          actor?: string;
          target?: string;
          from?: string;
          to?: string;
          tenantId?: string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfAuditEventDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/audit/export': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          format?: string;
          actionPrefix?: string;
          actor?: string;
          target?: string;
          from?: string;
          to?: string;
          tenantId?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/surveys': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SurveyDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateSurveyRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/surveys/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SurveyDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateSurveyRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SurveyDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/surveys/{id}/activate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ActivateSurveyRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SurveyDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    trace?: never;
  };
  '/api/v{version}/analytics/surveys/{id}/summary': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SurveyScoreSummary'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/surveys/{id}/responses': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/csat/responses/webchat': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CsatResponseRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CsatResponseDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/csat/responses/voice': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CsatResponseRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CsatResponseDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/csat/responses/email': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CsatResponseRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CsatResponseDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/csat/responses/sms': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CsatResponseRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CsatResponseDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/csat/queues/{queueId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          range?: string;
          channel?: string;
        };
        header?: never;
        path: {
          queueId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CsatResponseDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/analytics/csat': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          range?: string;
          channel?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CsatAggregateDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/csat/templates': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CsatTemplateDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/csat/templates/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CsatTemplateDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpsertCsatTemplateRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CsatTemplateDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description No Content */
        204: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/csat/templates/{id}/preview-voice': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/typification/schemas': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TypificationSchemaDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateSchemaRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/typification/schemas/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TypificationSchemaDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateSchemaRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TypificationSchemaDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PublishResultDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/typification/schemas/{id}/publish': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PublishResultDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/typification/schemas/{id}/calibration-status': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CalibrationStatusDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/typification/bindings': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SchemaBindingDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateBindingRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/typification/bindings/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SchemaBindingDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateBindingRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SchemaBindingDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PublishResultDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/typification/autonomous-disposition': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/ai/llm-config': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TenantLlmConfigResponse'];
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpsertLlmConfigRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TenantLlmConfigResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/ai/llm-config/test': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['TestLlmConnectionRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TestLlmConnectionResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/ai/credits': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['AiCreditsResponse'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/credit-ledger/top-up': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['TopUpRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CreditBalanceResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/credit-ledger/promo-grant': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['PromoGrantRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CreditBalanceResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/credit-ledger/partner-grant': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['PartnerGrantRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CreditBalanceResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/credit-ledger/balance': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CreditBalanceResponse'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/credit-ledger/entries': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          page: number | string;
          pageSize: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfCreditLedgerEntryDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/credit-ledger/remaining-by-source': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['SourceRemainingResponse'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/credit-ledger/attribution': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          to?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PartnerAttributionResponse'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/reason-hints': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ReasonHintDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateReasonHintRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/reason-hints/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ReasonHintDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateReasonHintRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ReasonHintDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/reports': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ScheduledReportDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateScheduledReportRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/reports/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ScheduledReportDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateScheduledReportRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/reports/{id}/run': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/reports/{id}/history': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          limit: number | string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/reports/{id}/history/{executionId}/download': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
          executionId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/realtime/profiles/default/{type}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          type: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['EndpointProfileDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/realtime/profiles/seed-defaults': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/realtime/profiles': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['EndpointProfileDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateEndpointProfileRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/realtime/profiles/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['EndpointProfileDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateEndpointProfileRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: number;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/auth/config': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TenantAuthConfigResponse'];
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateTenantAuthConfigRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TenantAuthConfigResponse'];
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/auth/events': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          page?: number | string;
          pageSize?: number | string;
          userId?: string;
          eventType?: string;
          startDate?: string;
          endDate?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfAuthEvent'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/auth/sessions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          userId?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ActiveSession'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/auth/sessions/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/auth/sessions/by-user/{userId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          userId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['RevokedSessionsResponse'];
          };
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/mfa/users': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          status?: string;
          tenant?: string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/mfa/users/{id}/reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: {
          targetTenant?: string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/mfa/users/{id}/sessions/revoke': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: {
          targetTenant?: string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/retention/targets': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/retention/config': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['RetentionConfigPatchDto'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    trace?: never;
  };
  '/api/v{version}/management/retention/run-now': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: {
          dryRun?: boolean;
          target?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/security/jwt/rotate-key': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/security/jwt/keys': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/oidc/login': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          tenant_id?: string;
          return_url?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/oidc/callback': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          code?: string;
          error?: string;
          error_description?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/auth/oidc/logout': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MessageResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/permissions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PermissionDefinition'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/permissions/categories': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PermissionGroupDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/role-templates': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['RoleTemplate'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/role-templates/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['RoleTemplate'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/roles': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TenantRole'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateTenantRoleRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/roles/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TenantRole'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateTenantRoleRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TenantRole'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/roles/{id}/clone': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CloneTenantRoleRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/users/{id}/roles': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['UserRoleAssignment'][];
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ReplaceUserRolesRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['UserRoleAssignment'][];
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/users/{id}/roles/{roleId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
          roleId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
          roleId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/users/{id}/permissions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['UserPermissionsDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/rate-cards': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          tenantId: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['RateCardDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query: {
          tenantId: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateRateCardRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/rate-cards/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: {
      parameters: {
        query: {
          tenantId: string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateRateCardRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['RateCardDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query: {
          tenantId: string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/invoices': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          tenantId: string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['InvoiceDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/invoices/generate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query: {
          tenantId: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['GenerateInvoiceRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/invoices/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          tenantId: string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['InvoiceDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/invoices/{id}/issue': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query: {
          tenantId: string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['StatusUpdateResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/invoices/{invoiceId}/pay': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query: {
          tenantId: string;
        };
        header?: never;
        path: {
          invoiceId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MessageResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{id}/dunning': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DunningRecordDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{id}/dunning/pause': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DunningRecordDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{id}/dunning/resume': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['DunningRecordDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{tenantId}/usage': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          until?: string;
        };
        header?: never;
        path: {
          tenantId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['UsageSummaryDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{tenantId}/usage/details': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          until?: string;
          type?: string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path: {
          tenantId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['UsageRecordDto'][];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{tenantId}/quota': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          tenantId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['QuotaStatusDto'];
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          tenantId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateQuotaRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['QuotaDto'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/impersonate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ImpersonateRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ImpersonateResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/impersonation/sessions/active': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          actorTenantId?: string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfImpersonationSessionDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/impersonation/sessions/{id}/revoke': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: {
        content: {
          'application/json': null | components['schemas']['RevokeImpersonationSessionRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/impersonation/sessions/history': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          actorTenantId?: string;
          from?: string;
          to?: string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfImpersonationSessionDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webhooks/subscriptions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['WebhookSubscription'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateWebhookSubscriptionRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webhooks/subscriptions/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['WebhookSubscription'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateWebhookSubscriptionRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['WebhookSubscription'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorDetailResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webhooks/subscriptions/{id}/test': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MessageResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webhooks/subscriptions/{id}/deliveries': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          page: number | string;
          pageSize: number | string;
        };
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfWebhookDelivery'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webhooks/subscriptions/{id}/rotate-secret': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['WebhookSubscription'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webhooks/subscriptions/{id}/reset-circuit': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MessageResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webhooks/subscriptions/{id}/circuit-status': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CircuitStatusResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/webhooks/dead-letter': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          tenantId: string;
          page: number | string;
          pageSize: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfWebhookDelivery'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/webhooks/dead-letter/{id}/retry': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MessageResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webhooks/event-types': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/gdpr/export': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: {
          format?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['GdprExportRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/gdpr/purge': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['GdprPurgeRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PurgeResult'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/gdpr/purge-user': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['GdprUserPurgeRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PurgeResult'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/gdpr/purge-preview': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query: {
          userId: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['UserPurgePreview'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/gdpr/purge-log': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          tenantId?: string;
          from?: string;
          to?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{tenantId}/retention': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          tenantId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['RetentionPolicyDto'];
          };
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          tenantId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateRetentionPolicyRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['RetentionPolicyDto'];
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/tenant/settings': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TenantSettingsDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateTenantSettingsRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{id}/settings': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TenantSettingsDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ManagementUpdateTenantSettingsRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{tenantId}/ip-allowlist': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          tenantId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['IpAllowlistListResponse'];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          tenantId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['AddIpAllowlistEntryRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/management/tenants/{tenantId}/ip-allowlist/{entryId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          tenantId: string;
          entryId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/customers': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          status?: string;
          plan?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PartnerCustomerDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreatePartnerCustomerRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/customers/{customerId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          customerId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PartnerCustomerDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          customerId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdatePartnerCustomerRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PartnerCustomerDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/customers/{customerId}/suspend': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          customerId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['SuspendCustomerRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['StatusUpdateResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/problem+json': components['schemas']['HttpValidationProblemDetails'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/customers/{customerId}/activate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          customerId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['StatusUpdateResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/customers/{customerId}/settings': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          customerId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TenantSettingsDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          customerId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateTenantSettingsRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/rate-cards': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['RateCardDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateRateCardRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/rate-cards/{rateCardId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          rateCardId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateRateCardRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['RateCardDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          rateCardId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/customers/{customerId}/invoices': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path: {
          customerId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['InvoiceDto'][];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/customers/{customerId}/invoices/generate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: {
          from?: string;
          to?: string;
        };
        header?: never;
        path: {
          customerId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/customers/{customerId}/usage': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          customerId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['UsageSummaryDto'][];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/revenue': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          until?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PartnerRevenueSummaryDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/revenue/details': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          from?: string;
          until?: string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PartnerRevenueDetailDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/partner/settings': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['TenantSettingsDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateTenantSettingsRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/branding/{tenantId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          tenantId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/branding/by-subdomain/{subdomain}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          subdomain: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/notifications': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          unreadOnly?: boolean;
          limit?: number | string;
          offset?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['NotificationDto'][];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/notifications/unread-count': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['UnreadCountDto'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/notifications/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['NotificationDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/notifications/{id}/read': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/notifications/read-all': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/onboarding/status': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['OnboardingStatusDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/onboarding/apply-template': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['ApplyTemplateRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MessageResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
        /** @description Conflict */
        409: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/onboarding/complete': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MessageResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/onboarding/dismiss-checklist': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MessageResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webchat/sessions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateSessionRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CreateSessionResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/webchat/sessions/{sessionId}/messages': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          sessionId: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['WebChatMessageRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['MessageResponse'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/canned-responses': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CannedResponseDto'][];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateCannedResponseRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/admin/canned-responses/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateCannedResponseRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['CannedResponseDto'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/cases': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: {
          status?: string;
          priority?: string;
          page?: number | string;
          pageSize?: number | string;
        };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['PagedResultOfCase'];
          };
        };
      };
    };
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateCaseRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/cases/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['Case'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
        };
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['UpdateCaseRequest'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['Case'];
          };
        };
        /** @description Bad Request */
        400: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v{version}/cases/{id}/conversations/{conversationId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          id: string;
          conversationId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['Case'];
          };
        };
        /** @description Not Found */
        404: {
          headers: {
            [name: string]: unknown;
          };
          content: {
            'application/json': components['schemas']['ErrorResponse'];
          };
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/internal/agent-tenant/{agentId}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path: {
          agentId: string;
        };
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/internal/hub-audit': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody: {
        content: {
          'application/json': components['schemas']['HubAuditEntry'];
        };
      };
      responses: {
        /** @description OK */
        200: {
          headers: {
            [name: string]: unknown;
          };
          content?: never;
        };
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    ActivateSurveyRequest: {
      isActive: boolean;
    };
    ActiveSession: {
      sessionId: string;
      userId: string;
      userEmail: string;
      userDisplayName: string;
      ipAddress: null | string;
      userAgent: null | string;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      expiresAt: string;
      /** Format: date-time */
      lastActivity: string;
    };
    ActiveSessionDto: {
      sessionId: string;
      agentId: null | string;
      queueName: null | string;
      callerIdNum: null | string;
      /** Format: date-time */
      connectedAt: null | string;
    };
    AddCallerIdEntryRequest: {
      phoneNumber: string;
      areaCode: null | string;
      isActive: null | boolean;
    };
    AddDncEntryRequest: {
      phoneNumber: string;
      reason: null | string;
      /** Format: date-time */
      expiresAt: null | string;
    };
    AddHolidayRequest: {
      date: string;
      name: string;
      allowedStart: null | string;
      allowedEnd: null | string;
    };
    AddIpAllowlistEntryRequest: {
      cidr: string;
      description: null | string;
    };
    AddMemberBody: {
      agentId: string;
      /** Format: int32 */
      penalty?: null | number | string;
      allowedChannels?: null | string[];
    };
    AddQueueMemberRequest: {
      queueId: string;
      agentId: string;
      /** Format: int32 */
      penalty?: null | number | string;
    };
    /**
     * @description W6-A6 — the admin agent representation returned by GET /admin/agents/{id} and
     *     /admin/agents (paged). Mirrors the fields the React admin UI consumed from the raw
     *     Agent entity, ADDING the raw per-agent ChannelCapacityOverrideDto? AdminAgentResponseDto.CapacityOverride
     *     (null when fully inherited, so the UI can render "inherited" vs "overridden") plus the
     *     resolved ChannelCapacity AdminAgentResponseDto.EffectiveCapacity (tenant default merged with the override,
     *     MaxVoice pinned). The plaintext SIP password is deliberately NOT carried (admin
     *     surfaces must never echo the secret — see AgentMeSipExposureTests).
     *     The Agent entity's OfflineSince, CreatedBy, and UpdatedBy are intentionally
     *     NOT projected (no admin-UI consumer today — add them here if a future supervisor surface needs them).
     */
    AdminAgentResponseDto: {
      agentId: string;
      tenantId: string;
      userId: string;
      displayName: string;
      state: components['schemas']['AgentState'];
      pendingState: null | components['schemas']['AgentState'];
      pendingReason: null | string;
      /** Format: date-time */
      pendingSince: null | string;
      hasPendingPause: boolean;
      teamId: null | string;
      skills: string[];
      extension: null | string;
      autoAnswer: null | boolean;
      canAcceptWork: boolean;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt: null | string;
      capacityOverride: null | components['schemas']['ChannelCapacityOverrideDto'];
      effectiveCapacity: components['schemas']['ChannelCapacity'];
    };
    AgentAssistConfigSnapshot: {
      /** Format: int32 */
      audioSocketPort: number | string;
      /** Format: int32 */
      suggestionTimeoutMs: number | string;
      /** Format: int32 */
      sentimentTimeoutMs: number | string;
      /** Format: int32 */
      complianceTimeoutMs: number | string;
      /** Format: int32 */
      maxHistorySegments: number | string;
      /** Format: int32 */
      inactivityTimeoutMinutes: number | string;
      whisperEnabled: boolean;
      whisperThreshold: string;
      filterQueueNames: string[];
      filterAgentIds: string[];
    };
    AgentAssistCredentialsDto: {
      apiKey: null | string;
      endpoint: null | string;
    };
    AgentAssistFeatureDto: {
      enabled: boolean;
      provider: null | string;
      credentialsConfigured: boolean;
      apiKeyMasked: null | string;
      endpointMasked: null | string;
      /** Format: date-time */
      updatedAt: null | string;
      updatedBy: null | string;
    };
    AgentAssistFeatureUpdateRequest: {
      enabled: boolean;
      provider: null | string;
      credentials: null | components['schemas']['AgentAssistCredentialsDto'];
    };
    AgentAssistSessionDto: {
      sessionId: string;
      tenantId: string;
      queueName: null | string;
      agentId: null | string;
      /** Format: date-time */
      startedAt: string;
      /** Format: date-time */
      endedAt: null | string;
      /** Format: int32 */
      suggestionCount: number | string;
      /** Format: int32 */
      complianceAlerts: number | string;
      /** Format: float */
      finalSentiment: null | number | string;
    };
    AgentIntervalDto: {
      agentId: string;
      /** Format: date-time */
      intervalStart: string;
      /** Format: int32 */
      intervalSeconds: number | string;
      /** Format: int32 */
      callsHandled: number | string;
      /** Format: double */
      ahtMs: number | string;
      /** Format: double */
      occupancyPercent: number | string;
      /** Format: int32 */
      rnaCount: number | string;
      /** Format: int32 */
      transfers: number | string;
      /** Format: int64 */
      totalPauseMs: number | string;
      /** Format: int64 */
      loginDurationMs: number | string;
    };
    /**
     * @description Response payload for `GET /agents/me`. Mirrors the serialized shape of
     *     Agent (kept stable for the Web client) and — unlike the entity,
     *     whose `SipPassword` is `[JsonIgnore]`d — deliberately surfaces the
     *     caller's own string? AgentMeResponseDto.Extension + string? AgentMeResponseDto.SipPassword so the
     *     in-browser SIP.js softphone can REGISTER (Phase 3A). This is the SINGLE
     *     place the plaintext SIP secret crosses an HTTP boundary, and only ever for
     *     the authenticated agent's own record (the endpoint resolves the agent from
     *     the caller's user id — JWT `sub` / API-key `user_id`).
     */
    AgentMeResponseDto: {
      agentId: string;
      tenantId: string;
      userId: string;
      displayName: string;
      state: components['schemas']['AgentState'];
      capacity: components['schemas']['ChannelCapacity'];
      teamId: null | string;
      skills: string[];
      extension: null | string;
      sipPassword: null | string;
      autoAnswer: null | boolean;
      canAcceptWork: boolean;
      pendingState: null | components['schemas']['AgentState'];
      pendingReason: null | string;
      /** Format: date-time */
      pendingSince: null | string;
      /** Format: int32 */
      activeWorkCount: number | string;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt: null | string;
    };
    /**
     * @description ADR-0026 Phase A.6 — agent-centric membership projection used by the
     *     `/admin/agents/{agentId}/queues` editor. Joins queue_memberships
     *     with queues so the React UI renders queue names + channel multi-selects
     *     without an N+1 fetch loop.
     */
    AgentQueueMembershipDto: {
      queueId: string;
      queueName: string;
      /** Format: int32 */
      penalty: number | string;
      isExcluded: boolean;
      allowedChannels: null | string[];
      source: string;
    };
    AgentSkillDto: {
      agentId: string;
      skillName: string;
      /** Format: int32 */
      proficiency: number | string;
    };
    /** @enum {unknown} */
    AgentState: 'Offline' | 'Available' | 'Busy' | 'Break' | 'Lunch' | 'Training' | 'ACW' | 'DND';
    AiConfigDto: {
      enabled: boolean;
      mode: string;
      /** Format: double */
      suggestThreshold: number | string;
      /** Format: double */
      autoApplyThreshold: number | string;
      /** Format: double */
      autonomousThreshold: number | string;
      autonomous: boolean;
      sentimentGating: boolean;
      /** Format: int64 */
      dailyTokenBudget: null | number | string;
      entityFieldMap?: null | {
        [key: string]: string;
      };
      piiAllowStore?: null | string[];
    };
    /**
     * @description C2 (P2c.2) — tenant AI credit usage readout. Credits are derived by aggregation (Σtokens ÷
     *     `PlatformLlmOptions.CreditTokenRatio`); the operator key/model are NEVER exposed here.
     */
    AiCreditsResponse: {
      /**
       * Format: int64
       * @description Monthly AI Credit allowance, or `null` for unlimited / pay-as-you-go.
       */
      allowanceCredits: null | number | string;
      /**
       * Format: int64
       * @description Credits consumed in the current calendar month (floor of tokens ÷ ratio).
       */
      consumedCredits: number | string;
      /**
       * Format: int64
       * @description Allowance minus consumed (floored at 0), or `null` when unlimited.
       */
      remainingCredits: null | number | string;
      /**
       * Format: double
       * @description Consumed ÷ allowance × 100, or 0 when the allowance is unlimited / zero.
       */
      usagePercent: number | string;
      /**
       * Format: date-time
       * @description Exclusive end of the current usage period (first instant of next month, UTC).
       */
      periodEnd: string;
      /** @description The tenant's `QuotaAction` name (Warn / SoftBlock / HardBlock). */
      actionOnExhaustion: string;
    };
    /**
     * @description Ownership discriminator for a tenant's Typification LLM provider — distinct
     *     from ProviderType (the provider *family*). `Byo` uses the
     *     tenant's own encrypted key; `PlatformManaged` uses Verbara's operator
     *     key (host-bound `PlatformLlmOptions`), metered + billed in AI Credits.
     * @enum {unknown}
     */
    AiSource: 'Byo' | 'PlatformManaged';
    ApiKeyLoginRequest: {
      apiKey: string;
    };
    ApplyTemplateRequest: {
      template: string;
    };
    ArticleDto: {
      id: string;
      title: string;
      content: string;
      tags: string[];
      published: boolean;
      language: null | string;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt: string;
    };
    AssignSkillRequest: {
      skillName: string;
      /** Format: int32 */
      proficiency: null | number | string;
    };
    /**
     * @description Wire shape returned by the R5.2 PB.1 audit log viewer endpoints. Mirrors
     *     AuditEntry with snake-case JSON
     *     nullable-everywhere so the React DataTable can render rows directly.
     */
    AuditEventDto: {
      entryId: string;
      tenantId: string;
      action: string;
      category: string;
      severity: string;
      actorId: string;
      actorType: string;
      targetId?: null | string;
      targetType?: null | string;
      correlationId?: null | string;
      impersonatorId?: null | string;
      /** Format: date-time */
      occurredAt: string;
      /**
       * @description Status surface — currently mirrors string AuditEventDto.Severity until
       *         the entry model gains a dedicated outcome field. The Web table uses it as
       *         a separate column to leave room for the future split.
       */
      status: string;
      /**
       * @description Before snapshot for mutation events. `null` when not a mutation
       *         or when the storage layer doesn't persist before/after (legacy Postgres rows).
       */
      before?: unknown;
      after?: unknown;
      metadata?: null | {
        [key: string]: string;
      };
    };
    AuthEvent: {
      eventId: string;
      tenantId: string;
      userId?: null | string;
      eventType: string;
      ipAddress?: null | string;
      userAgent?: null | string;
      details?: null | components['schemas']['JsonDocument'];
      /** Format: date-time */
      createdAt: string;
    };
    AuthSettingsDto: {
      mfaPolicy: string;
      mfaRequiredRoles: string[];
      /** Format: int32 */
      passwordMinLength: number | string;
      passwordRequireUppercase: boolean;
      passwordRequireNumber: boolean;
      passwordRequireSpecial: boolean;
      /** Format: int32 */
      lockoutThreshold: number | string;
      /** Format: int32 */
      lockoutDurationMinutes: number | string;
      /** Format: int32 */
      sessionIdleTimeoutMinutes: number | string;
      /** Format: int32 */
      sessionAbsoluteTimeoutHours: number | string;
      oidcEnabled: boolean;
      oidcAuthority: null | string;
      oidcClientId: null | string;
      oidcAutoCreateUsers: boolean;
      oidcDefaultRole: string;
      /** Format: int32 */
      impersonationMaxConcurrentSessions: number | string;
      /** Format: int32 */
      impersonationAutoTimeoutMinutes: number | string;
      ipAllowlistEnabled: boolean;
    };
    BotDto: {
      id: string;
      name: string;
      defaultFlowId: null | string;
      fallbackQueueId: null | string;
      /** Format: double */
      confidenceThreshold: number | string;
      /** Format: int32 */
      maxTurns: number | string;
      isActive: boolean;
      /** Format: date-time */
      createdAt: string;
    };
    BrandingSettingsDto: {
      displayName: null | string;
      logoUrl: null | string;
      faviconUrl: null | string;
      primaryColor: null | string;
      secondaryColor: null | string;
      accentColor: null | string;
      locale: null | string;
      timezone: null | string;
      subdomain: null | string;
      supportEmail: null | string;
      supportUrl: null | string;
      emailFromName: null | string;
      emailFromAddress: null | string;
    };
    CalibrationStatusDto: {
      /** Format: int32 */
      samples: number | string;
      /** Format: double */
      accuracy: number | string;
      autoFillReady: boolean;
      autonomousReady: boolean;
    };
    CallbackDto: {
      /** Format: int64 */
      campaignId: number | string;
      /** Format: int64 */
      contactId: number | string;
      /** Format: date-time */
      scheduledAt: string;
      agentId: null | string;
    };
    CallerIdEntryDto: {
      /** Format: int64 */
      id: number | string;
      phoneNumber: string;
      areaCode: null | string;
      isActive: boolean;
    };
    CallerIdPoolDto: {
      /** Format: int64 */
      id: number | string;
      name: string;
    };
    CampaignDetailDto: {
      /** Format: int64 */
      id: number | string;
      name: string;
      description: null | string;
      status: string;
      mode: string;
      queueName: string;
      teamName: null | string;
      /** Format: int32 */
      maxConcurrentCalls: number | string;
      /** Format: double */
      powerRatio: null | number | string;
      /** Format: double */
      targetAbandonRate: null | number | string;
      timezone: string;
      campaignStart: null | string;
      campaignEnd: null | string;
      schedule: components['schemas']['ScheduleDayDto'][];
      holidays: string[];
      dncEnabled: boolean;
      /** Format: int32 */
      maxAttemptsPerContact: number | string;
      /** Format: int32 */
      retryIntervalMinutes: number | string;
      /** Format: int32 */
      timeBetweenAttemptsMinutes: number | string;
      complianceNotes: null | string;
      /** Format: int32 */
      totalContacts: number | string;
      /** Format: int32 */
      contactsDialed: number | string;
      /** Format: date-time */
      createdAt: string;
    };
    CampaignMetricsDto: {
      /** Format: int64 */
      campaignId: number | string;
      campaignName: string;
      status: string;
      /** Format: int32 */
      contactsDialed: number | string;
      /** Format: int32 */
      contactsRemaining: number | string;
      /** Format: double */
      connectRate: number | string;
      /** Format: double */
      abandonRate: number | string;
      /** Format: int32 */
      activeCalls: number | string;
      /** Format: double */
      pacingRate: number | string;
    };
    CampaignSummaryDto: {
      /** Format: int64 */
      id: number | string;
      name: string;
      status: string;
      queueName: string;
      mode: string;
      /** Format: int32 */
      totalContacts: number | string;
      /** Format: int32 */
      contactsDialed: number | string;
    };
    CannedResponseDto: {
      responseId: string;
      shortcut: string;
      title: string;
      body: string;
      category: null | string;
      tags: string[];
      createdBy: string;
      /** Format: date-time */
      createdAt: string;
    };
    Case: {
      caseId: components['schemas']['EntityId'];
      tenantId: components['schemas']['TenantId'];
      caseNumber: string;
      subject: string;
      priority: components['schemas']['CasePriority'];
      status: components['schemas']['CaseStatus'];
      contactId: components['schemas']['EntityId'];
      assignedAgentId?: null | components['schemas']['EntityId'];
      slaPolicyId?: null | components['schemas']['EntityId'];
      conversationIds?: null | unknown[];
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt?: null | string;
      createdBy?: null | string;
      updatedBy?: null | string;
    };
    /** @enum {unknown} */
    CasePriority: 'Low' | 'Normal' | 'High' | 'Urgent';
    /** @enum {unknown} */
    CaseStatus: 'Open' | 'Pending' | 'Resolved' | 'Closed';
    CdrDetailDto: {
      cdr: components['schemas']['CdrRowDto'];
      timeline: components['schemas']['CdrTimelineEventDto'][];
      qaSummary: null | components['schemas']['CdrQaSummaryDto'];
      calledNumber: null | string;
      linkedSessionId: null | string;
      /** Format: int16 */
      transferCount: number | string;
      recordingName: null | string;
      recordingStreamUrl: null | string;
      hasTranscript: boolean;
    };
    CdrQaSummaryDto: {
      reason: null | string;
      outcome: null | string;
      narrative: null | string;
      /** Format: double */
      qaScore: null | number | string;
      sentimentLabel: null | string;
    };
    CdrRowDto: {
      sessionId: string;
      /** Format: date-time */
      startTime: string;
      /** Format: date-time */
      answerTime: null | string;
      /** Format: date-time */
      endTime: string;
      contact: null | string;
      channel: string;
      queueName: null | string;
      agentName: null | string;
      /** Format: int64 */
      durationMs: number | string;
      /** Format: int64 */
      talkTimeMs: null | number | string;
      /** Format: int64 */
      waitTimeMs: null | number | string;
      disposition: string;
      slaMet: boolean;
      hasQaScore: boolean;
      /** Format: double */
      qaScore: null | number | string;
      sentimentLabel: null | string;
      hasRecording: boolean;
      transferredTo: null | string;
      /** Format: int16 */
      transferType: null | number | string;
      /** Format: int16 */
      hangupSource: null | number | string;
      /** Format: int64 */
      wrapUpDurationMs: null | number | string;
      /** Format: int16 */
      holdCount: number | string;
      /** Format: int64 */
      ringDurationMs: null | number | string;
      campaignName: null | string;
      dispositionName: null | string;
      metadata: null | {
        [key: string]: string;
      };
    };
    CdrTimelineEventDto: {
      event: string;
      /** Format: date-time */
      timestamp: string;
      detail: null | string;
    };
    ChangePasswordRequest: {
      oldPassword: string;
      newPassword: string;
      mfaCode?: null | string;
    };
    ChannelAddress: {
      channel: components['schemas']['ChannelType'];
      address: string;
    };
    ChannelAddressDto: {
      channel: components['schemas']['ChannelType'];
      address: string;
    };
    ChannelCapacity: {
      /** Format: int32 */
      maxVoice?: number | string;
      /** Format: int32 */
      maxChat?: number | string;
      /** Format: int32 */
      maxEmail?: number | string;
      /** Format: int32 */
      maxSms?: number | string;
      /**
       * Format: int32
       * @description W6 — the cap on the SUM of concurrently handled async channels (chat-pool +
       *     email + sms). Enforced SEPARATELY (not via int ChannelCapacity.GetMax(ChannelType channel), which is a
       *     strictly per-channel limit); the capacity service tallies async load across
       *     channels and rejects work that would push the combined count past this cap.
       */
      maxTotal?: number | string;
    };
    /**
     * @description W6-A6 — wire shape for the per-agent ChannelCapacityOverride. Each null field
     *     means "inherit the tenant default" for that channel; a non-null value overrides it. Returned
     *     on the admin agent representation as `capacityOverride` (null when fully inherited) and
     *     accepted on create/update as `capacity`.
     */
    ChannelCapacityOverrideDto: {
      /** Format: int32 */
      maxVoice: null | number | string;
      /** Format: int32 */
      maxChat: null | number | string;
      /** Format: int32 */
      maxEmail: null | number | string;
      /** Format: int32 */
      maxSms: null | number | string;
      /** Format: int32 */
      maxTotal: null | number | string;
    };
    ChannelDistributionDto: {
      channel: string;
      /** Format: int32 */
      count: number | string;
    };
    ChannelTestResponse: {
      success: boolean;
      message: string;
    };
    /** @enum {unknown} */
    ChannelType:
      | 'Voice'
      | 'WhatsApp'
      | 'Sms'
      | 'WebChat'
      | 'Email'
      | 'Messenger'
      | 'Instagram'
      | 'Telegram'
      | 'Twitter'
      | 'Video'
      | 'Rcs';
    ChecklistItemDto: {
      key: string;
      label: string;
      completed: boolean;
    };
    /**
     * @default Closed
     * @enum {unknown}
     */
    CircuitStatus: 'Closed' | 'Open' | 'HalfOpen';
    CircuitStatusResponse: {
      subscriptionId: string;
      status: string;
      /** Format: int32 */
      failures: number | string;
      /** Format: date-time */
      openedAt: null | string;
      /** Format: date-time */
      nextProbeAt: null | string;
      /** Format: int32 */
      probeAttempts: number | string;
    };
    CloneTenantRoleRequest: {
      name: string;
      description?: null | string;
    };
    CoachingNoteRequest: {
      text: string;
    };
    ComplianceAlertRowDto: {
      /** Format: int64 */
      id: number | string;
      sessionId: string;
      tenantId: string;
      /** Format: date-time */
      occurredAt: string;
      ruleId: string;
      phrase: null | string;
      severity: string;
    };
    ComplianceRuleDto: {
      ruleId: string;
      pattern: string;
      severity: string;
      action: string;
      description: null | string;
    };
    ComplianceRuleSummaryDto: {
      ruleId: string;
      ruleName: string;
      severity: string;
      /** Format: int32 */
      occurrences: number | string;
      /** Format: int32 */
      sessionsAffected: number | string;
      /** Format: date-time */
      firstSeen: string;
      /** Format: date-time */
      lastSeen: string;
    };
    ComplianceSeverityBreakdownDto: {
      /** Format: int32 */
      info: number | string;
      /** Format: int32 */
      warning: number | string;
      /** Format: int32 */
      critical: number | string;
    };
    ComplianceSummaryResponse: {
      rules: components['schemas']['ComplianceRuleSummaryDto'][];
      /** Format: int32 */
      totalViolations: number | string;
      /** Format: int32 */
      totalSessionsWithViolations: number | string;
      severityBreakdown: components['schemas']['ComplianceSeverityBreakdownDto'];
      /** Format: date-time */
      from: string;
      /** Format: date-time */
      to: string;
    };
    ComplianceViolationDto: {
      ruleName: string;
      severity: string;
      description: string;
      evidence: null | string;
    };
    ConditionExprDto: {
      refType: string;
      ref: string;
      op: string;
      value: null | string;
    };
    Contact: {
      contactId: components['schemas']['EntityId'];
      tenantId: components['schemas']['TenantId'];
      firstName?: null | string;
      lastName?: null | string;
      company?: null | string;
      segment?: null | string;
      preferredChannel?: null | components['schemas']['ChannelType'];
      preferredLanguage?: null | string;
      timezone?: null | string;
      doNotContact?: boolean;
      addresses?: null | components['schemas']['ChannelAddress'][];
      customFields?: null | {
        [key: string]: string;
      };
      channelConsent?: null | {
        [key: string]: boolean;
      };
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt?: null | string;
      createdBy?: null | string;
      updatedBy?: null | string;
      fullName?: null | string;
    };
    ContactImportRowDto: {
      firstName: string;
      lastName: null | string;
      phone: string;
      phoneType: null | string;
      metadata: null | {
        [key: string]: string;
      };
    };
    ContactListDto: {
      /** Format: int64 */
      id: number | string;
      name: string;
      /** Format: int32 */
      totalContacts: number | string;
      /** Format: int32 */
      pendingContacts: number | string;
      /** Format: int32 */
      completedContacts: number | string;
      sourceFileName: null | string;
      /** Format: date-time */
      createdAt: string;
    };
    Conversation: {
      conversationId: components['schemas']['EntityId'];
      tenantId: components['schemas']['TenantId'];
      contactId: components['schemas']['EntityId'];
      channel: components['schemas']['ChannelType'];
      owner?: null | components['schemas']['ConversationOwner'];
      state: components['schemas']['ConversationState'];
      caseId?: null | components['schemas']['EntityId'];
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      closedAt?: null | string;
      /** Format: date-time */
      updatedAt?: null | string;
      createdBy?: null | string;
      updatedBy?: null | string;
      /**
       * @description For voice conversations: the Asterisk call-global `LinkedId` (shared by every
       *     channel of one physical call). Acts as the per-call idempotency correlation key
       *     (unique per tenant via a partial index, migration 027) so the leader-emit voice
       *     bridge never creates a duplicate Conversation across a leadership failover.
       *     `null` for every non-voice conversation. Settable (not init-only) because an
       *     OUTBOUND voice Conversation (3B.2d) is pre-created by the dial service BEFORE the live call
       *     exists, then the bridge stamps the real LinkedId on `CallConnected` (inbound sets it at
       *     creation). The stores persist it on UPDATE, so a later stamp is durable.
       */
      voiceLinkedId?: null | string;
      /**
       * Format: int32
       * @description W5 — queue ordering priority; lower sorts earlier. 0 = normal FIFO (by CreatedAt);
       *     failover re-queue sets -1 to jump to the front.
       */
      queuePriority?: number | string;
      metadata?: null | {
        [key: string]: string;
      };
      sessions?: null | components['schemas']['IConversationSession'][];
    };
    ConversationOwner: {
      kind: components['schemas']['ConversationOwnerKind'];
      ownerId?: unknown;
    };
    /** @enum {unknown} */
    ConversationOwnerKind: 'System' | 'Bot' | 'Agent' | 'Queue';
    /** @enum {unknown} */
    ConversationState:
      | 'Queued'
      | 'Offered'
      | 'Active'
      | 'OnHold'
      | 'Consulting'
      | 'WrapUp'
      | 'WaitingForCustomer'
      | 'Snoozed'
      | 'Resolved'
      | 'Escalated'
      | 'Closed'
      | 'Abandoned'
      | 'Merged'
      | 'Spam';
    /**
     * @description Append-only correction state of a TypificationSubmission (ADR-0034 Decision 5).
     *     An autonomously stamped disposition stays immutable; a supervisor correction creates a NEW
     *     corrective submission that references the original — the original is then marked
     *     CorrectionState.Corrected. The conversation is NOT transitioned back to WrapUp.
     * @enum {unknown}
     */
    CorrectionState: 'None' | 'Corrected';
    CreateAgentRequest: {
      userId: string;
      displayName: string;
      extension?: null | string;
      sipPassword?: null | string;
      autoAnswer?: null | boolean;
      capacity?: null | components['schemas']['ChannelCapacityOverrideDto'];
      queueMemberships?: null | components['schemas']['QueueMembershipRequest'][];
    };
    CreateArticleRequest: {
      title: string;
      content: string;
      tags?: null | string[];
      isPublished?: null | boolean;
      language?: null | string;
    };
    CreateBindingRequest: {
      scope: string;
      scopeRef: null | string;
      schemaId: string;
      subtreeRootNodeId: null | string;
      /** Format: int32 */
      priority: number | string;
      aiConfigOverride?: null | components['schemas']['AiConfigDto'];
    };
    CreateBotRequest: {
      name: string;
      defaultFlowId?: null | string;
      fallbackQueueId?: null | string;
      /** Format: double */
      confidenceThreshold?: null | number | string;
      /** Format: int32 */
      maxTurns?: null | number | string;
      isActive?: null | boolean;
    };
    CreateCallbackRequest: {
      /** Format: int64 */
      contactId: number | string;
      phone: string;
      agentId: null | string;
      scheduledAt: string;
    };
    CreateCallerIdPoolRequest: {
      name: string;
    };
    CreateCampaignRequest: {
      name: string;
      description: null | string;
      mode: string;
      targetQueueName: string;
      teamId: null | string;
      /** Format: int32 */
      maxConcurrentCalls: number | string;
      /** Format: double */
      powerRatio: null | number | string;
      /** Format: double */
      targetAbandonRate: null | number | string;
      timezone: string;
      campaignStart: null | string;
      campaignEnd: null | string;
      schedule: components['schemas']['ScheduleDayDto'][];
      holidays: string[];
      dncEnabled: boolean;
      /** Format: int32 */
      maxAttemptsPerContact: number | string;
      /** Format: int32 */
      retryIntervalMinutes: number | string;
      /** Format: int32 */
      timeBetweenAttemptsMinutes: number | string;
      complianceNotes: null | string;
    };
    CreateCannedResponseRequest: {
      shortcut: string;
      title: string;
      body: string;
      category: null | string;
      tags: null | string[];
    };
    CreateCaseRequest: {
      subject: string;
      priority: string;
      contactId: string;
      assignedAgentId: null | string;
    };
    CreateContactListRequest: {
      name: string;
    };
    CreateContactRequest: {
      firstName?: null | string;
      lastName?: null | string;
      company?: null | string;
      segment?: null | string;
      preferredChannel?: null | components['schemas']['ChannelType'];
      preferredLanguage?: null | string;
      timezone?: null | string;
      addresses?: null | components['schemas']['ChannelAddressDto'][];
      customFields?: null | {
        [key: string]: string;
      };
    };
    CreateConversationRequest: {
      contactId: string;
      channel: string;
      initialMessage?: null | string;
    };
    CreateDidRouteRequest: {
      did: string;
      queueId: string;
      isActive: boolean;
    };
    CreateDispositionCodeRequest: {
      code: string;
      label: string;
      category: string;
      isSuccess: boolean;
      triggerRetry: boolean;
      /** Format: int32 */
      retryDelayMinutes: null | number | string;
      triggerCallback: boolean;
    };
    CreateDncListRequest: {
      name: string;
      scope: null | string;
    };
    CreateEndpointProfileRequest: {
      name: string;
      type: string;
      transport: null | string;
      codecs: null | string;
      webrtc: null | boolean;
      /** Format: int32 */
      maxContacts: null | number | string;
      directMedia: null | boolean;
      context: null | string;
      /** Format: int32 */
      qualifyFrequency: null | number | string;
    };
    CreateFlowRequest: {
      name: string;
      entryNodeId?: null | string;
      nodes?: null | components['schemas']['FlowNodeDto'][];
    };
    CreateHolidayCalendarRequest: {
      name: string;
    };
    CreateMgmtApiKeyRequest: {
      name?: null | string;
      /** Format: int32 */
      expiresInDays?: null | number | string;
    };
    CreateMgmtApiKeyResponse: {
      keyId: string;
      name: string;
      apiKey: string;
      /** Format: date-time */
      expiresAt: null | string;
    };
    CreateMgmtTenantRequest: {
      tenantId: string;
      name: string;
      type?: components['schemas']['TenantType'];
      parentTenantId?: null | string;
      /** Format: int32 */
      maxConcurrentChannels?: null | number | string;
      /** Format: int32 */
      maxActiveCampaigns?: null | number | string;
      metadata?: null | {
        [key: string]: string;
      };
      template?: null | string;
    };
    CreateNodeRequest: {
      nodeId: string;
      amiHostname: string;
      /** Format: int32 */
      amiPort: number | string;
      amiUsername: string;
      amiPassword: string;
      /**
       * Format: double
       * @default 1
       */
      weight: number | string;
      /**
       * Format: int32
       * @default 0
       */
      priorityTier: number | string;
      /**
       * Format: int32
       * @default 500
       */
      maxCapacity: number | string;
      tags?: null | {
        [key: string]: string;
      };
    };
    CreateOutboundRouteRequest: {
      /** Format: int64 */
      campaignId: null | number | string;
      pattern: string;
      patternType: string;
      /** Format: int64 */
      trunkId: number | string;
      /** Format: int64 */
      overflowTrunkId: null | number | string;
      dialPrefix: null | string;
      /** Format: int32 */
      priority: number | string;
    };
    CreatePartnerCustomerRequest: {
      tenantId: string;
      name: string;
      plan?: null | string;
      template?: null | string;
    };
    CreateQueueRequest: {
      name: string;
      slaTargets?: null | components['schemas']['SlaPolicyTargetDto'];
      overflowRule?: null | components['schemas']['QueueOverflowRuleDto'];
      wrapUp?: null | components['schemas']['WrapUpConfigDto'];
      /** Format: int32 */
      maxWaiting?: null | number | string;
      requiredSkills?: null | string[];
      autoAnswerDefault?: null | boolean;
    };
    CreateRateCardRequest: {
      name: string;
      currency: string;
      /** Format: date-time */
      effectiveFrom: string;
      /** Format: date-time */
      effectiveTo: null | string;
      isDefault: boolean;
      rates: components['schemas']['RateEntryDto'][];
    };
    CreateReasonHintRequest: {
      scope: string;
      scopeRef: string;
      reasonPath: string;
      /** Format: int32 */
      priority: number | string;
      isActive: boolean;
    };
    CreateScheduledReportRequest: {
      name: string;
      type: string;
      schedule: string;
      format: string;
      isActive: boolean;
      filters?: null | string;
      recipients?: null | string;
      reportType?: null | string;
      effectiveType?: null | string;
    };
    CreateSchemaRequest: {
      name: string;
      /** Format: int32 */
      maxDepth: number | string;
      nodes: components['schemas']['TypificationNodeDto'][];
      fields: components['schemas']['TypificationFieldDto'][];
      aiConfig?: null | components['schemas']['AiConfigDto'];
    };
    CreateSessionRequest: {
      tenantId: string;
    };
    CreateSessionResponse: {
      sessionId: string;
      wsUrl: string;
    };
    CreateSkillRequest: {
      name: string;
      category: null | string;
      description: null | string;
    };
    CreateSurveyRequest: {
      name: string;
      type: components['schemas']['SurveyType'];
      questions: components['schemas']['SurveyQuestionDto'][];
      isActive?: null | boolean;
    };
    CreateTeamRequest: {
      name: string;
    };
    CreateTenantRoleRequest: {
      name: string;
      description?: null | string;
      sourceTemplateId?: null | string;
      permissions?: null | string[];
    };
    CreateTrunkRequest: {
      name: string;
      displayName: null | string;
      type: string;
      isActive: boolean;
      /** Format: int32 */
      maxChannels: number | string;
      transport: null | string;
      codecs: null | string;
      authUsername: null | string;
      authPassword: null | string;
      registrationUri: null | string;
      clientUri: null | string;
      context: null | string;
      matchHost: null | string;
    };
    CreateUserRequest: {
      email: string;
      displayName: string;
      role: components['schemas']['UserRole'];
      password?: null | string;
    };
    CreateWebhookSubscriptionRequest: {
      name: string;
      endpointUrl: string;
      eventTypes: string[];
    };
    /** @description c1 — the tenant's current O(1) AI-credit balance projection. */
    CreditBalanceResponse: {
      /**
       * Format: double
       * @description Current credit balance (never negative).
       */
      balance: number | string;
    };
    /**
     * @description c1 — a single AI-credit ledger entry projected for the tenant read API. The domain
     *     CreditLedgerEntry is never serialized directly; enums are surfaced as their names.
     */
    CreditLedgerEntryDto: {
      /** @description Ledger entry id (EntityId hex). */
      entryId: string;
      /** @description `Grant` or `Debit`. */
      entryType: string;
      /** @description Economic source (`Subscription`, `TopUp`, `Promo`, `Partner`, `PostPaid`). */
      source: string;
      /**
       * Format: double
       * @description Signed credit amount (positive for grants, negative for debits).
       */
      amount: number | string;
      /** @description Top-up idempotency key, if any. */
      externalRef: null | string;
      /**
       * Format: date-time
       * @description When this (grant) lot expires, if any.
       */
      expiresAt: null | string;
      /**
       * Format: date-time
       * @description When the entry was appended (UTC).
       */
      createdAt: string;
    };
    /**
     * @description Scope-wide CSAT roll-up returned by `GET /api/v1/analytics/csat` (csat-completion,
     *     Platform/ADR-0020). The envelope carries the tenant/scope totals; each IReadOnlyList&lt;CsatResponseDto&gt; CsatAggregateDto.Queues row
     *     reuses the existing CsatResponseDto projection verbatim (one row per queue), frozen by
     *     `fixtures/csat-aggregate-analytics.v1.json` (verbatim-fixture-citation rule).
     */
    CsatAggregateDto: {
      /**
       * Format: int32
       * @description Sum of CSAT responses across every queue in the scope/range.
       */
      totalResponses: number | string;
      /**
       * Format: double
       * @description Response-weighted mean rating (1..5) across the scope; 0 when none.
       */
      averageRating: number | string;
      /**
       * Format: date-time
       * @description Inclusive start of the captured-at range.
       */
      rangeStart: string;
      /**
       * Format: date-time
       * @description Inclusive end of the captured-at range.
       */
      rangeEnd: string;
      /** @description One CsatResponseDto row per queue contributing to the totals. */
      queues: components['schemas']['CsatResponseDto'][];
    };
    /**
     * @description Per-queue CSAT analytics summary returned by
     *     `GET /api/v1/analytics/csat/queues/{queueId}` (csat-runner Phase B). Projects
     *     the `Verbara.Platform.Surveys.SurveyScoreSummary` computed by
     *     `ISurveyAnalytics.GetByQueueAndChannelAsync` over the channel-indexed rows.
     */
    CsatResponseDto: {
      /** @description The queue the aggregates cover. */
      queueName: string;
      /** @description The channel filter the aggregates were computed for. */
      channel: string;
      /**
       * Format: int32
       * @description Number of CSAT responses in the requested range.
       */
      totalResponses: number | string;
      /**
       * Format: double
       * @description Mean CSAT rating (1..5) across the responses; 0 when none.
       */
      averageRating: number | string;
      /**
       * Format: date-time
       * @description Inclusive start of the captured-at range.
       */
      rangeStart: string;
      /**
       * Format: date-time
       * @description Inclusive end of the captured-at range.
       */
      rangeEnd: string;
    };
    /**
     * @description The frozen CSAT capture wire shape (csat-runner Phase B, D2). Bound verbatim by
     *     `POST /api/v1/csat/responses/{webchat,email,sms}` — every field name matches
     *     `fixtures/csat-response-capture.v1.json` 1:1 (verbatim-fixture-citation rule)
     *     and maps onto the `Verbara.Platform.Surveys.SurveyResponse` CSAT extension +
     *     `SurveyQuestionIds.CsatRating`.
     */
    CsatResponseRequest: {
      /**
       * @description The channel token authorizing the capture. For `webchat` this is the
       *     Platform-minted, session-signed `v1.{payload}.{sig}` token whose signed
       *     tenant/queue/channel MUST match the submitted string CsatResponseRequest.QueueName and
       *     string CsatResponseRequest.Channel; missing, malformed, expired, or mismatched tokens are rejected.
       */
      responseToken: string;
      /** @description The survey this rating belongs to (fixture `surveyId`). */
      surveyId: string;
      /** @description The single-question CSAT rating id — `SurveyQuestionIds.CsatRating` (fixture `questionId`). */
      questionId: string;
      /** @description Capture channel: `webchat`, `email`, or `sms` (fixture `channel`). */
      channel: string;
      /** @description Originating queue name (fixture `queueName`). */
      queueName: string;
      /**
       * Format: int32
       * @description The CSAT rating in 1..5 (fixture `rating`); values outside 1..5 are rejected.
       */
      rating: number | string;
      /** @description Optional free-text comment (fixture `comment`). */
      comment: null | string;
      /**
       * Format: date-time
       * @description The instant the visitor submitted the rating (fixture `capturedAt`).
       */
      capturedAt: string;
      /** @description The correlated conversation id (fixture `conversationId`). */
      conversationId: string;
    };
    /**
     * @description Serialized projection of a per-tenant CSAT prompt template (csat-runner Phase B/E).
     *     Mirrors the wire shape the admin template surface (`/api/v1/admin/csat/templates/*`,
     *     Phase E) manages and the `Verbara.Sdk.Pro.CsatRunner.ICsatTemplateProvider`
     *     resolves in-process. Webchat uses i18n strings and carries no per-tenant template.
     */
    CsatTemplateDto: {
      /** @description The template id, unique per `(tenant, template)`. */
      templateId: string;
      /** @description The channel the prompt is for: `voice`, `email`, or `sms`. */
      channel: string;
      /** @description The template locale (BCP-47, e.g. `en-US`). */
      locale: string;
      /** @description Subject line for channels that carry one (email); null otherwise. */
      subject: null | string;
      /** @description The prompt body — the email message, SMS text, or voice TTS prompt. */
      body: string;
    };
    CurrentIntervalDto: {
      /** Format: date-time */
      intervalStart: string;
      /** Format: date-time */
      intervalEnd: string;
      /** Format: int32 */
      callsOffered: number | string;
      /** Format: int32 */
      callsAnswered: number | string;
      /** Format: int32 */
      callsAbandoned: number | string;
      /** Format: double */
      ahtMs: number | string;
      /** Format: double */
      asaMs: number | string;
      /** Format: double */
      slaPercent: number | string;
      /** Format: double */
      abandonRatePercent: number | string;
    };
    DashboardDto: {
      kpis: components['schemas']['DashboardKpisDto'];
      previousPeriodKpis: null | components['schemas']['DashboardKpisDto'];
      volumeTrend: components['schemas']['TrendPointDto'][];
      slaTrend: components['schemas']['TrendPointDto'][];
      channelDistribution: components['schemas']['ChannelDistributionDto'][];
    };
    DashboardKpisDto: {
      /** Format: int32 */
      conversationsHandled: number | string;
      /** Format: double */
      avgWaitMs: number | string;
      /** Format: double */
      avgHandleTimeMs: number | string;
      /** Format: double */
      slaPercent: number | string;
      /** Format: double */
      abandonRatePercent: number | string;
    };
    DidRouteDto: {
      id: string;
      did: string;
      queueId: string;
      isActive: boolean;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt: null | string;
    };
    DispositionCodeDto: {
      /** Format: int64 */
      id: number | string;
      code: string;
      label: string;
      category: string;
      isSuccess: boolean;
      triggerRetry: boolean;
      /** Format: int32 */
      retryDelayMinutes: null | number | string;
      triggerCallback: boolean;
      isActive: boolean;
      /** Format: int32 */
      sortOrder: number | string;
    };
    DncCheckResultDto: {
      exists: boolean;
    };
    DncEntryDto: {
      /** Format: int64 */
      id: number | string;
      phoneNumber: string;
      reason: null | string;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      expiresAt: null | string;
    };
    DncImportResultDto: {
      /** Format: int32 */
      imported: number | string;
      /** Format: int32 */
      skipped: number | string;
    };
    DncListDto: {
      /** Format: int64 */
      id: number | string;
      name: string;
      scope: string;
      /** Format: int32 */
      entryCount: number | string;
      /** Format: date-time */
      createdAt: string;
    };
    DunningRecordDto: {
      dunningId: string;
      tenantId: string;
      invoiceId: string;
      currentStage: string;
      /** Format: date-time */
      startedAt: string;
      /** Format: date-time */
      escalatedAt: null | string;
      /** Format: date-time */
      resolvedAt: null | string;
      isPaused: boolean;
      isActive: boolean;
    };
    DunningStatusDto: {
      invoiceId: string;
      currentStage: string;
      /** Format: date-time */
      startedAt: string;
      /** Format: date-time */
      escalatedAt: null | string;
      isPaused: boolean;
    };
    EndpointProfileDto: {
      /** Format: int64 */
      id: number | string;
      name: string;
      type: string;
      isDefault: boolean;
      transport: string;
      codecs: string;
      webrtc: boolean;
      /** Format: int32 */
      maxContacts: number | string;
      directMedia: boolean;
      context: string;
      /** Format: int32 */
      qualifyFrequency: number | string;
    };
    EntityId: unknown;
    ErrorDetailResponse: {
      error: string;
      details: string[];
    };
    ErrorResponse: {
      error: string;
    };
    FieldOptionDto: {
      value: string;
      label: string;
    };
    FieldValidationDto: {
      regex: null | string;
      /** Format: double */
      min: null | number | string;
      /** Format: double */
      max: null | number | string;
      /** Format: int32 */
      maxLength: null | number | string;
    };
    FlowEdgeDto: {
      condition: string;
      targetNodeId: string;
    };
    FlowNodeDto: {
      nodeId: string;
      type: string;
      config?: null | {
        [key: string]: string;
      };
      edges?: null | components['schemas']['FlowEdgeDto'][];
    };
    /**
     * @description W3 (A6) — request body for the admin force-offline lever. When
     *     RevokeSessions is true, the target agent's refresh-token
     *     sessions are revoked (RevokeAllForUserAsync) so a wedged client cannot
     *     silently re-establish a session after the supervisor kicks it Offline.
     */
    ForceAgentOfflineRequest: {
      revokeSessions: boolean;
    };
    ForgotPasswordRequest: {
      tenantId: string;
      email: string;
    };
    GdprExportRequest: {
      contactId: string;
    };
    GdprPurgeRequest: {
      contactId: string;
      reason: string;
    };
    GdprUserPurgeRequest: {
      userId: string;
      reason: string;
    };
    GenerateInvoiceRequest: {
      /** Format: date-time */
      periodStart: string;
      /** Format: date-time */
      periodEnd: string;
    };
    HolidayCalendarDto: {
      /** Format: int64 */
      id: number | string;
      name: string;
    };
    HolidayDto: {
      /** Format: int64 */
      id: number | string;
      date: string;
      name: string;
      allowedStart: null | string;
      allowedEnd: null | string;
    };
    HttpValidationProblemDetails: {
      type?: null | string;
      title?: null | string;
      /** Format: int32 */
      status?: null | number | string;
      detail?: null | string;
      instance?: null | string;
      errors?: {
        [key: string]: string[];
      };
    };
    /**
     * @description Audit-log entry payload posted from Verbara.Platform.Realtime to
     *     `POST /api/v1/internal/hub-audit` on Verbara.Platform.Api when a
     *     hub event needs persistent recording (cross-tenant subscription denials,
     *     supervisor whisper attempts, etc.). Mirrors the Pro.Push.SignalR.Authz
     *     HubAuditEntry shape so the Realtime sink adapter is a straight field copy.
     *     Fire-and-forget — Realtime does not wait for ack.
     */
    HubAuditEntry: {
      /** @description Stable action token (e.g. `hub.cross_tenant_subscription_denied`). */
      action: string;
      /** @description Tenant of the connected user (from JWT `tid` claim). */
      actorTenantId: string;
      /** @description Subject identifier of the connected user (JWT `sub` claim, fallback `"unknown"`). */
      actorId: string;
      /** @description Identifier of the entity the actor tried to act on (typically the agent id). */
      targetId: null | string;
      /** @description Optional free-form serialised metadata. */
      metadata: null | string;
      /**
       * Format: date-time
       * @description UTC timestamp Realtime observed the event.
       */
      at: string;
    };
    IConversationSession: {
      sessionId?: components['schemas']['EntityId'];
      channel?: components['schemas']['ChannelType'];
      state?: components['schemas']['SessionState'];
      /** Format: date-time */
      startedAt?: string;
      /** Format: date-time */
      endedAt?: null | string;
    };
    ImpersonateRequest: {
      targetTenantId: string;
      /** @default false */
      readOnly: boolean;
      reason?: null | string;
    };
    ImpersonateResponse: {
      accessToken: string;
      /** Format: date-time */
      expiresAt: string;
      targetTenantId: string;
      targetTenantName: string;
      readOnly: boolean;
      sessionId: string;
    };
    /** @description Wire shape for the active + history list endpoints. */
    ImpersonationSessionDto: {
      id: string;
      actorUserId: string;
      actorTenantId: string;
      targetUserId: null | string;
      targetTenantId: string;
      reason: null | string;
      readOnly: boolean;
      /** Format: date-time */
      startedAt: string;
      /** Format: date-time */
      endedAt: null | string;
      status: string;
      closeReason: null | string;
      /** Format: int32 */
      timeRemainingSeconds: null | number | string;
      /** Format: date-time */
      expiresAt: null | string;
    };
    ImportContactsRequest: {
      contacts: components['schemas']['ContactImportRowDto'][];
    };
    ImportResultDto: {
      /** Format: int32 */
      imported: number | string;
      /** Format: int32 */
      skipped: number | string;
      /** Format: int32 */
      duplicates: number | string;
    };
    IntervalDto: {
      queueName: string;
      /** Format: date-time */
      intervalStart: string;
      /** Format: int32 */
      intervalSeconds: number | string;
      /** Format: int32 */
      callsOffered: number | string;
      /** Format: int32 */
      callsAnswered: number | string;
      /** Format: int32 */
      callsAbandoned: number | string;
      /** Format: double */
      slaPercent: number | string;
      /** Format: double */
      asaMs: number | string;
      /** Format: double */
      ahtMs: number | string;
      /** Format: double */
      abandonRatePercent: number | string;
      /** Format: int32 */
      slaMetCount: number | string;
    };
    InvoiceDto: {
      invoiceId: string;
      tenantId: string;
      /** Format: date-time */
      periodStart: string;
      /** Format: date-time */
      periodEnd: string;
      currency: string;
      lineItems: components['schemas']['InvoiceLineItemDto'][];
      /** Format: double */
      subtotal: number | string;
      /** Format: double */
      tax: number | string;
      /** Format: double */
      total: number | string;
      status: string;
      /** Format: date-time */
      generatedAt: string;
      /** Format: date-time */
      issuedAt: null | string;
      /** Format: date-time */
      paidAt: null | string;
      paymentStatus: string;
      /** Format: date-time */
      dueDate: null | string;
    };
    InvoiceLineItemDto: {
      usageType: string;
      description: string;
      /** Format: double */
      quantity: number | string;
      /** Format: double */
      unitPrice: number | string;
      /** Format: double */
      amount: number | string;
      /** Format: double */
      includedQuantity: number | string;
      /** Format: double */
      overageQuantity: number | string;
    };
    IpAllowlistEntryDto: {
      /** Format: uuid */
      id: string;
      cidr: string;
      description: null | string;
      /** Format: date-time */
      createdAt: string;
    };
    IpAllowlistListResponse: {
      enabled: boolean;
      entries: components['schemas']['IpAllowlistEntryDto'][];
    };
    JsonDocument: unknown;
    KeywordRuleDto: {
      ruleId: string;
      keyword: string;
      priority: string;
      suggestionText: null | string;
    };
    LeafOutcomeDto: {
      category: string;
      triggerRetry: boolean;
      /** Format: int32 */
      retryDelayMinutes: null | number | string;
      triggerCallback: boolean;
      dialerCode: null | string;
      isActive: boolean;
    };
    LicenseInfoDto: {
      isValid: boolean;
      licenseId: null | string;
      licensee: null | string;
      status: string;
      /** Format: date-time */
      expiresAt: null | string;
      licensedFeatures: string[];
      /** Format: int32 */
      maxNodes: number | string;
      /** Format: date-time */
      lastValidatedAt: string;
      inGrace: boolean;
      gracePeriodRemaining: null | string;
      blocked: boolean;
    };
    LicenseStatusSnapshot: {
      isLoaded?: boolean;
      isValid?: boolean;
      tier?: components['schemas']['LicenseTier'];
      /** Format: date-time */
      expiresAt?: null | string;
      /** Format: int32 */
      maxAgents?: null | number | string;
      /** Format: int32 */
      maxNodes?: null | number | string;
      /** Format: int32 */
      authorizedDigestsCount?: number | string;
      lastValidationResult?: components['schemas']['LicenseValidationResult'];
      /** Format: date-time */
      lastValidationAt?: null | string;
      revalidationInterval?: null | string;
      licensee?: null | string;
    };
    /** @enum {unknown} */
    LicenseTier:
      | 'None'
      | 'Developer'
      | 'SelfHostStartup'
      | 'SelfHostBusiness'
      | 'SaaSBusiness'
      | 'SaaSEnterprise'
      | 'WhiteLabel';
    /** @enum {unknown} */
    LicenseValidationResult:
      | 'Valid'
      | 'Invalid'
      | 'Expired'
      | 'GracePeriod'
      | 'MissingFeature'
      | 'UnauthorizedImage';
    ListenEntry: {
      supervisorId: string;
      sessionId: string;
      /** Format: date-time */
      startedAt: string;
    };
    ListenRequest: {
      supervisorId: string;
    };
    LiveStateDto: {
      queueName: string;
      /** Format: int32 */
      callsWaiting: number | string;
      /** Format: int64 */
      longestWaitMs: number | string;
      /** Format: int32 */
      agentsAvailable: number | string;
      /** Format: int32 */
      agentsOnCall: number | string;
      /** Format: int32 */
      agentsPaused: number | string;
      /** Format: int32 */
      agentsInWrapUp: number | string;
    };
    LoginRequest: {
      tenantId: null | string;
      email: string;
      password: string;
    };
    ManagementUpdateTenantSettingsRequest: {
      operational?: null | components['schemas']['UpdateOperationalSettingsDto'];
      auth?: null | components['schemas']['UpdateAuthSettingsDto'];
      quotas?: null | components['schemas']['UpdateQuotaSettingsDto'];
      retention?: null | components['schemas']['UpdateRetentionSettingsDto'];
      rateLimitTier?: null | components['schemas']['RateLimitTier'];
      plan?: null | components['schemas']['TenantPlan'];
      addOns?: null | components['schemas']['PlanFeature'][];
      branding?: null | components['schemas']['UpdateManagementBrandingSettingsDto'];
    };
    Message: {
      messageId: components['schemas']['EntityId'];
      conversationId: components['schemas']['EntityId'];
      tenantId: components['schemas']['TenantId'];
      direction: components['schemas']['MessageDirection'];
      channel: components['schemas']['ChannelType'];
      senderId?: null | string;
      content: components['schemas']['MessageEnvelope'];
      deliveryStatus: components['schemas']['MessageDeliveryStatus'];
      externalMessageId?: null | string;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      deliveredAt?: null | string;
      /** Format: date-time */
      readAt?: null | string;
      /** Format: date-time */
      updatedAt?: null | string;
      createdBy?: null | string;
      updatedBy?: null | string;
    };
    MessageBlock:
      | components['schemas']['MessageBlockTextBlock']
      | components['schemas']['MessageBlockImageBlock']
      | components['schemas']['MessageBlockAudioBlock']
      | components['schemas']['MessageBlockVideoBlock']
      | components['schemas']['MessageBlockFileBlock']
      | components['schemas']['MessageBlockLocationBlock']
      | components['schemas']['MessageBlockInteractiveBlock'];
    MessageBlockAudioBlock: {
      /** @enum {string} */
      $type?: 'audio';
      url: string;
      duration: null | string;
      mimeType: null | string;
      type?: components['schemas']['MessageBlockType'];
    };
    MessageBlockFileBlock: {
      /** @enum {string} */
      $type?: 'file';
      url: string;
      fileName: string;
      mimeType: null | string;
      /** Format: int64 */
      sizeBytes: null | number | string;
      type?: components['schemas']['MessageBlockType'];
    };
    MessageBlockImageBlock: {
      /** @enum {string} */
      $type?: 'image';
      url: string;
      caption: null | string;
      mimeType: null | string;
      type?: components['schemas']['MessageBlockType'];
    };
    MessageBlockInteractiveBlock: {
      /** @enum {string} */
      $type?: 'interactive';
      body: string;
      replies: components['schemas']['QuickReply'][];
      type?: components['schemas']['MessageBlockType'];
    };
    MessageBlockLocationBlock: {
      /** @enum {string} */
      $type?: 'location';
      /** Format: double */
      latitude: number | string;
      /** Format: double */
      longitude: number | string;
      name: null | string;
      type?: components['schemas']['MessageBlockType'];
    };
    MessageBlockTextBlock: {
      /** @enum {string} */
      $type?: 'text';
      text: string;
      type?: components['schemas']['MessageBlockType'];
    };
    /** @enum {unknown} */
    MessageBlockType: 'Text' | 'Image' | 'Audio' | 'Video' | 'File' | 'Location' | 'Interactive';
    MessageBlockVideoBlock: {
      /** @enum {string} */
      $type?: 'video';
      url: string;
      caption: null | string;
      mimeType: null | string;
      type?: components['schemas']['MessageBlockType'];
    };
    /** @enum {unknown} */
    MessageDeliveryStatus: 'Pending' | 'Sent' | 'Delivered' | 'Failed' | 'Read';
    /** @enum {unknown} */
    MessageDirection: 'Inbound' | 'Outbound' | 'System';
    MessageEnvelope: {
      blocks: components['schemas']['MessageBlock'][];
    };
    MessageResponse: {
      message: string;
    };
    MfaConfirmRequest: {
      code: string;
    };
    MfaDisableRequest: {
      password: string;
    };
    MfaEnrollCompleteRequest: {
      acknowledged: boolean;
    };
    MfaEnrollVerifyRequest: {
      secret: string;
      totpCode: string;
    };
    MfaVerifyRequest: {
      mfaToken: string;
      code: null | string;
      recoveryCode: null | string;
    };
    MgmtApiKeyDto: {
      keyId: string;
      name: string;
      isRevoked: boolean;
      /** Format: date-time */
      expiresAt: null | string;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      lastUsedAt: null | string;
    };
    MgmtClusterNodeDto: {
      nodeId: string;
      state: string;
      /** Format: double */
      weight: number | string;
      /** Format: int32 */
      priorityTier: number | string;
      /** Format: int32 */
      maxCapacity: number | string;
      asteriskVersion: null | string;
      startupTime: null | string;
    };
    MgmtClusterStatusDto: {
      instanceId: string;
      nodes: components['schemas']['MgmtClusterNodeDto'][];
      /** Format: int32 */
      totalChannels: number | string;
      /** Format: int32 */
      totalAgents: number | string;
      activeDrains: components['schemas']['MgmtDrainStatusDto'][];
      instances: components['schemas']['MgmtInstanceDto'][];
    };
    MgmtDrainNodeRequest: {
      /** Format: int32 */
      gracePeriodSeconds: null | number | string;
    };
    MgmtDrainStatusDto: {
      nodeId: string;
      state: string;
      /** Format: date-time */
      startedAt: string;
      /** Format: date-time */
      deadline: string;
      /** Format: int32 */
      initialCallCount: number | string;
      /** Format: int32 */
      remainingCallCount: number | string;
      /** Format: int32 */
      naturallyCompleted: number | string;
      /** Format: int32 */
      forceDisconnected: number | string;
      estimatedTimeToZero: null | string;
    };
    MgmtInstanceDto: {
      instanceId: string;
      /** Format: date-time */
      lastSeen: string;
      ownedNodeIds: string[];
      /** Format: int32 */
      totalChannels: number | string;
      /** Format: int32 */
      totalAgents: number | string;
    };
    MgmtTenantDto: {
      tenantId: string;
      name: string;
      status: string;
      type: string;
      parentTenantId: null | string;
      /** Format: int32 */
      maxConcurrentChannels: number | string;
      /** Format: int32 */
      maxActiveCampaigns: number | string;
      metadata: null | {
        [key: string]: string;
      };
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt: string;
    };
    NotificationDto: {
      notificationId: string;
      type: string;
      category: string;
      severity: string;
      title: string;
      body: string;
      actionUrl: null | string;
      isRead: boolean;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      readAt: null | string;
    };
    OnboardingStatusDto: {
      wizardCompleted: boolean;
      templateApplied: null | string;
      checklist: components['schemas']['ChecklistItemDto'][];
      checklistDismissed: boolean;
    };
    OperationalSettingsDto: {
      /** Format: int32 */
      maxConcurrentChannels: number | string;
      /** Format: int32 */
      maxActiveCampaigns: number | string;
      dialplanContextPrefix: null | string;
      nodeAffinity: null | string[];
      allowedDialingModes: null | (number | string)[];
      outboundCallerId: null | string;
      /** Format: int32 */
      maxVoiceDefault: number | string;
      /** Format: int32 */
      maxChatDefault: number | string;
      /** Format: int32 */
      maxEmailDefault: number | string;
      /** Format: int32 */
      maxSmsDefault: number | string;
      /** Format: int32 */
      maxTotalDefault: number | string;
    };
    OutboundRouteDto: {
      /** Format: int64 */
      id: number | string;
      /** Format: int64 */
      campaignId: null | number | string;
      pattern: string;
      patternType: string;
      /** Format: int64 */
      trunkId: number | string;
      /** Format: int64 */
      overflowTrunkId: null | number | string;
      dialPrefix: null | string;
      /** Format: int32 */
      priority: number | string;
    };
    OwnershipResult: {
      success: boolean;
      newOwner: null | components['schemas']['ConversationOwner'];
      newState: components['schemas']['ConversationState'];
      failureReason: null | string;
    };
    PagedDataResponseOfCdrRowDto: {
      data: components['schemas']['CdrRowDto'][];
      hasMore: boolean;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
    };
    PagedDataResponseOfQaRowDto: {
      data: components['schemas']['QaRowDto'][];
      hasMore: boolean;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
    };
    PagedResultOfAdminAgentResponseDto: {
      items: components['schemas']['AdminAgentResponseDto'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    PagedResultOfAuditEventDto: {
      items: components['schemas']['AuditEventDto'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    PagedResultOfAuthEvent: {
      items: components['schemas']['AuthEvent'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    PagedResultOfCampaignSummaryDto: {
      items: components['schemas']['CampaignSummaryDto'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    PagedResultOfCase: {
      items: components['schemas']['Case'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    PagedResultOfContact: {
      items: components['schemas']['Contact'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    PagedResultOfConversation: {
      items: components['schemas']['Conversation'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    PagedResultOfCreditLedgerEntryDto: {
      items: components['schemas']['CreditLedgerEntryDto'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    PagedResultOfImpersonationSessionDto: {
      items: components['schemas']['ImpersonationSessionDto'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    PagedResultOfQueueDto: {
      items: components['schemas']['QueueDto'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    PagedResultOfTeamDto: {
      items: components['schemas']['TeamDto'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    PagedResultOfUserDto: {
      items: components['schemas']['UserDto'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    PagedResultOfWebhookDelivery: {
      items: components['schemas']['WebhookDelivery'][];
      /** Format: int32 */
      totalCount: number | string;
      /** Format: int32 */
      page: number | string;
      /** Format: int32 */
      pageSize: number | string;
      /** Format: int32 */
      totalPages?: number | string;
      hasNextPage?: boolean;
      hasPreviousPage?: boolean;
    };
    /**
     * @description c2 — one partner-attribution line: the partner-funded AI-credit consumption attributable to a single Customer
     *     child for the window, derived on read from the ledger (no invoice, no materialized table).
     */
    PartnerAttributionLineDto: {
      /** @description The Customer child tenant id. */
      customerTenantId: string;
      /**
       * Format: double
       * @description Σ `|Partner-source debits|` for this customer in the window.
       */
      credits: number | string;
    };
    /**
     * @description c2 — derive-on-read partner attribution for the caller's Partner tenant over a window: the total partner-funded
     *     consumption plus the per-Customer breakdown. Computed from ICreditLedgerStore + the existing
     *     single-hop tenant hierarchy — no invoice and no materialized aggregation table (ADR-0033 (c2) addendum).
     */
    PartnerAttributionResponse: {
      /**
       * Format: double
       * @description Σ of the per-customer decimal PartnerAttributionLineDto.Credits.
       */
      total: number | string;
      /** @description One line per direct Customer child with attributable partner-funded consumption. */
      customers: components['schemas']['PartnerAttributionLineDto'][];
    };
    PartnerCustomerDto: {
      tenantId: string;
      name: string;
      status: string;
      plan: string;
      /** Format: date-time */
      createdAt: string;
    };
    /**
     * @description c2 (credit-ledger-lots) — operator partner-allocation grant body. Mints a CreditSource.Partner
     *     grant + lot for TenantId (whose parent MUST be a `Partner`) of Amount
     *     credits, idempotent on IdempotencyKey. Partner draws never enter the customer-owed invoice.
     */
    PartnerGrantRequest: {
      /** @description Target Customer tenant (parent must be a Partner) the credits are minted onto. */
      tenantId: string;
      /**
       * Format: double
       * @description Positive credit amount to grant.
       */
      amount: number | string;
      /** @description Caller-supplied idempotency key; a repeat is a no-op. */
      idempotencyKey: string;
    };
    PartnerRevenueDetailDto: {
      revenueId: string;
      customerTenantId: string;
      invoiceId: string;
      /** Format: double */
      grossAmount: number | string;
      /** Format: double */
      platformCost: number | string;
      /** Format: double */
      partnerMargin: number | string;
      /** Format: date-time */
      periodStart: string;
      /** Format: date-time */
      periodEnd: string;
    };
    PartnerRevenueSummaryDto: {
      /** Format: double */
      totalGross: number | string;
      /** Format: double */
      totalPlatformCost: number | string;
      /** Format: double */
      totalMargin: number | string;
      /** Format: int32 */
      customerCount: number | string;
      /** Format: int32 */
      invoiceCount: number | string;
    };
    PauseMemberBody: {
      reason: null | string;
    };
    PauseResultDto: {
      queueId: string;
      agentId: string;
      isPaused: boolean;
      reason: null | string;
      realtimeSynced: boolean;
    };
    PermissionDefinition: {
      permissionId: string;
      category: string;
      resource: string;
      action: string;
      description: string;
      implies: string[];
    };
    PermissionGroupDto: {
      category: string;
      permissions: components['schemas']['PermissionDefinition'][];
    };
    /** @enum {unknown} */
    PlanFeature:
      | 'Dialer'
      | 'BotBasic'
      | 'BotAdvanced'
      | 'AgentAssist'
      | 'CallAnalytics'
      | 'AnalyticsExport'
      | 'Flows'
      | 'Webhooks'
      | 'OidcSso'
      | 'ScheduledReports'
      | 'KnowledgeBase'
      | 'Recordings'
      | 'RecordingTranscription'
      | 'IpAllowlist'
      | 'PlatformLlm';
    PrefillSourceDto: {
      kind: string;
      ref: string;
    };
    ProfileRegenerateRecoveryCodesRequest: {
      totpCode: string;
    };
    /**
     * @description c2 (credit-ledger-lots) — operator promotional grant body. Mints a CreditSource.Promo grant +
     *     lot for TenantId of Amount credits, optionally expiring at
     *     ExpiresAt, idempotent on IdempotencyKey (→ the entry's `external_ref`).
     */
    PromoGrantRequest: {
      /** @description Target tenant the promo credits are minted onto. */
      tenantId: string;
      /**
       * Format: double
       * @description Positive credit amount to grant.
       */
      amount: number | string;
      /** @description Caller-supplied idempotency key; a repeat is a no-op. */
      idempotencyKey: string;
      /**
       * Format: date-time
       * @description Optional lot expiry; the reclaim sweeper claws back the unconsumed remainder after this.
       */
      expiresAt: null | string;
    };
    /**
     * @description Type-specific provider configuration, persisted as a single JSONB column
     *     (`tenant_llm_config.provider_settings`) and source-gen serialized (AOT).
     *     Extensible: a new provider type adds a nullable field here — code only, no DB migration.
     */
    ProviderSettings: {
      /** @description Base URL for ProviderType.OpenAiCompatible / Azure resource endpoint. */
      baseUrl?: null | string;
      /** @description Azure OpenAI deployment name (ProviderType.AzureOpenAi). */
      azureDeployment?: null | string;
      /** @description Azure OpenAI `api-version` query parameter (ProviderType.AzureOpenAi). */
      azureApiVersion?: null | string;
      /** @description Anthropic `anthropic-version` header value (ProviderType.Anthropic); default applies when null. */
      anthropicVersion?: null | string;
    };
    /**
     * @description The LLM provider family a tenant configures for BYO (bring-your-own) typification AI.
     *     The discriminator persisted in `tenant_llm_config.provider_type` and switched on by
     *     the resolver to select the concrete ILlmProvider implementation (P2c.1).
     * @enum {unknown}
     */
    ProviderType: 'OpenAiCompatible' | 'AzureOpenAi' | 'Anthropic';
    PublishErrorDto: {
      field: string;
      message: string;
    };
    PublishResultDto: {
      ok: boolean;
      errors: components['schemas']['PublishErrorDto'][];
    };
    /** @description Result of a GDPR purge operation. EntitiesDeleted maps entity type to count. */
    PurgeResult: {
      purgeId: string;
      entitiesDeleted: {
        [key: string]: number | string;
      };
      /** Format: date-time */
      purgedAt: string;
    };
    QaCriterionDto: {
      category: string;
      /** Format: double */
      score: number | string;
      /** Format: double */
      weight: number | string;
      passed: boolean;
      feedback: null | string;
    };
    QaDetailDto: {
      sessionId: string;
      /** Format: date-time */
      analyzedAt: string;
      agentName: null | string;
      queueName: null | string;
      reason: null | string;
      outcome: null | string;
      narrative: null | string;
      actionItems: string[];
      /** Format: double */
      qaScore: number | string;
      /** Format: double */
      maxPossibleScore: number | string;
      criteria: components['schemas']['QaCriterionDto'][];
      violations: components['schemas']['ComplianceViolationDto'][];
      sentimentLabel: null | string;
      sentimentTrend: null | string;
      /** Format: float */
      sentimentScore: null | number | string;
      primaryTopic: null | string;
      allTopics: components['schemas']['TopicDto'][];
      sentimentTimeline: components['schemas']['TurnSentimentDto'][];
      /** Format: double */
      agentTalkRatio: null | number | string;
      /** Format: int32 */
      silenceCount: null | number | string;
      /** Format: int32 */
      interruptionCount: null | number | string;
    };
    QaRowDto: {
      sessionId: string;
      /** Format: date-time */
      analyzedAt: string;
      agentName: null | string;
      queueName: null | string;
      /** Format: double */
      qaScore: number | string;
      summaryNarrative: null | string;
      hasComplianceViolations: boolean;
      /** Format: int32 */
      violationCount: number | string;
      sentimentLabel: null | string;
      topics: string[];
    };
    QueueDto: {
      id: string;
      name: string;
      isActive: boolean;
      /** Format: int32 */
      maxWaiting: null | number | string;
      slaTargets: null | components['schemas']['SlaPolicyTarget'];
      overflowRule: null | components['schemas']['QueueOverflowRule'];
      wrapUp: components['schemas']['WrapUpConfig'];
      requiredSkills: string[];
      autoAnswerDefault: boolean;
      /** Format: date-time */
      createdAt: string;
    };
    /** @description Projected queue-member row exposed by QueueMembersEndpoints. */
    QueueMemberDto: {
      /** @description Queue identifier. */
      queueId: string;
      /** @description Agent identifier. */
      agentId: string;
      /** @description Agent display name projected for the UI. */
      displayName: string;
      /**
       * Format: int32
       * @description Queue penalty (0-10); higher = lower priority.
       */
      penalty: number | string;
      /** @description True when the agent is excluded from this queue. */
      isExcluded: boolean;
      /**
       * @description Per-queue pause state for the UI badge. BEST-EFFORT: maintained by an in-process
       *     QueueMemberPauseTracker, not persisted to the queue_memberships table.
       *     Authoritative pause state lives in Asterisk Realtime's `queue_members.paused` column.
       *     Multi-instance deploys may see stale values on replicas that didn't originate the
       *     pause. Scheduled for promotion to Postgres/Redis in R2 / R5.2.
       */
      isPaused: boolean;
      /** @description Optional reason string associated with an active pause. */
      pauseReason: null | string;
      /** @description Membership source — `Manual` or `Skill`. */
      source: string;
      /**
       * @description ADR-0026 Phase A.6 channel-aware membership. `null` means the agent
       *     is a member for all channels the queue accepts (pre-v2.6.0 implicit
       *     behavior). A populated list restricts membership to the listed channels
       *     only and gates Asterisk sync (voice in list ⇒ sync; voice out ⇒ no sync).
       */
      allowedChannels?: null | string[];
    };
    /**
     * @description ADR-0026: channel-aware queue membership specification at agent creation.
     *     AllowedChannels=null means the agent is a member for all channels the
     *     queue accepts (preserves implicit pre-v2.6.0 behavior). A populated list
     *     restricts this membership to the listed channels only — both for routing
     *     eligibility (Phase B) and Asterisk queue_members sync (Phase A: skipped
     *     when voice not in AllowedChannels).
     */
    QueueMembershipRequest: {
      queueId: string;
      allowedChannels?: null | string[];
      /** Format: int32 */
      penalty?: null | number | string;
    };
    QueueMetricsDto: {
      queueId: string;
      queueName: string;
      /** Format: int32 */
      waiting: null | number | string;
      /** Format: double */
      avgWaitSeconds: null | number | string;
      /** Format: double */
      slaPercent: number | string;
      /** Format: int32 */
      agentsAvailable: number | string;
      /** Format: int32 */
      agentsBusy: number | string;
      /** Format: int32 */
      agentsAway: number | string;
    };
    QueueOverflowRule: {
      overflowQueueId: components['schemas']['EntityId'];
      /** Format: int32 */
      overflowAfterSeconds: number | string;
    };
    QueueOverflowRuleDto: {
      overflowQueueId: string;
      /** Format: int32 */
      overflowAfterSeconds: number | string;
    };
    QuickReply: {
      id: string;
      title: string;
    };
    QuotaDto: {
      /** Format: int32 */
      maxConcurrentChannels: number | string;
      /** Format: int32 */
      maxActiveCampaigns: number | string;
      /** Format: int64 */
      maxMonthlyVoiceMinutes: null | number | string;
      /** Format: int64 */
      maxMonthlyMessages: null | number | string;
      /** Format: int64 */
      maxStorageBytes: null | number | string;
      /** Format: int32 */
      maxActiveAgents: null | number | string;
      quotaAction: string;
    };
    QuotaSettingsDto: {
      /** Format: int64 */
      maxMonthlyVoiceMinutes: null | number | string;
      /** Format: int64 */
      maxMonthlyMessages: null | number | string;
      /** Format: int64 */
      maxStorageBytes: null | number | string;
      /** Format: int32 */
      maxActiveAgents: null | number | string;
      quotaAction: string;
    };
    QuotaStatusDto: {
      tenantId: string;
      quota: null | components['schemas']['QuotaDto'];
      currentUsage: components['schemas']['UsageSummaryDto'][];
    };
    RateCardDto: {
      rateCardId: string;
      tenantId: string;
      name: string;
      currency: string;
      /** Format: date-time */
      effectiveFrom: string;
      /** Format: date-time */
      effectiveTo: null | string;
      isDefault: boolean;
      rates: components['schemas']['RateEntryDto'][];
    };
    RateEntryDto: {
      usageType: string;
      /** Format: double */
      unitPrice: number | string;
      /** Format: double */
      includedQuantity: number | string;
      tiers: null | components['schemas']['RateTierDto'][];
    };
    /** @enum {unknown} */
    RateLimitTier: 'Unlimited' | 'Free' | 'Standard' | 'Professional' | 'Enterprise';
    RateTierDto: {
      /** Format: double */
      fromQuantity: number | string;
      /** Format: double */
      toQuantity: null | number | string;
      /** Format: double */
      unitPrice: number | string;
    };
    ReasonHintDto: {
      id: string;
      scope: string;
      scopeRef: string;
      reasonPath: string;
      /** Format: int32 */
      priority: number | string;
      isActive: boolean;
    };
    ReassignConversationRequest: {
      targetQueueId: null | string;
      targetAgentId: null | string;
    };
    RecordingMetadataDto: {
      sessionId: string;
      recordingName: string;
      hasRecording: boolean;
      streamUrl: string;
    };
    RegenerateRecoveryCodesRequest: {
      password: string;
    };
    ReplaceUserRolesRequest: {
      roleIds: string[];
    };
    ResetPasswordRequest: {
      token: string;
      newPassword: string;
    };
    /**
     * @description PATCH body for `/management/retention/config`. Only `DryRun` can be
     *     flipped at runtime in v1 — window / batch / cron require process restart per
     *     the underlying `IOptions&lt;RetentionOptions&gt;` snapshot semantics.
     */
    RetentionConfigPatchDto: {
      /**
       * @description New value for `DryRun`. `null` = leave unchanged.
       *     Toggling emits an `retention.dryrun_toggled` audit entry with the
       *     previous + new value in metadata.
       */
      dryRun?: null | boolean;
    };
    RetentionPolicyDto: {
      tenantId: string;
      /** Format: int32 */
      conversationRetentionDays: null | number | string;
      /** Format: int32 */
      authEventRetentionDays: null | number | string;
      /** Format: int32 */
      auditRetentionDays: null | number | string;
      /** Format: int32 */
      usageRecordRetentionDays: null | number | string;
    };
    RetentionSettingsDto: {
      /** Format: int32 */
      conversationRetentionDays: null | number | string;
      /** Format: int32 */
      authEventRetentionDays: null | number | string;
      /** Format: int32 */
      auditRetentionDays: null | number | string;
      /** Format: int32 */
      usageRecordRetentionDays: null | number | string;
    };
    RevokedSessionsResponse: {
      /** Format: int32 */
      revokedCount: number | string;
    };
    RevokeImpersonationSessionRequest: {
      reason?: null | string;
    };
    RoleTemplate: {
      templateId: string;
      name: string;
      description: string;
      isSystem: boolean;
      /** Format: date-time */
      createdAt: string;
      permissions?: null | string[];
    };
    ScheduleDayDto: {
      day: string;
      enabled: boolean;
      start: string;
      end: string;
    };
    ScheduledReportDto: {
      id: string;
      name: string;
      type: string;
      schedule: string;
      filters: null | string;
      recipients: null | string;
      format: string;
      isActive: boolean;
      createdBy: string;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt: string;
      /** Format: date-time */
      lastRunAt: null | string;
      /** Format: date-time */
      nextRunAt: null | string;
    };
    SchemaBindingDto: {
      bindingId: string;
      scope: string;
      scopeRef: null | string;
      schemaId: string;
      subtreeRootNodeId: null | string;
      /** Format: int32 */
      priority: number | string;
      aiConfigOverride?: null | components['schemas']['AiConfigDto'];
    };
    SendMessageRequest: {
      text: string;
    };
    SentimentTrendPointDto: {
      /** Format: date-time */
      bucketStart: string;
      /** Format: double */
      avgSentimentScore: null | number | string;
      /** Format: int32 */
      positiveCount: number | string;
      /** Format: int32 */
      neutralCount: number | string;
      /** Format: int32 */
      negativeCount: number | string;
      /** Format: int32 */
      totalCount: number | string;
    };
    SentimentTrendsResponse: {
      points: components['schemas']['SentimentTrendPointDto'][];
      bucket: string;
      /** Format: date-time */
      from: string;
      /** Format: date-time */
      to: string;
    };
    /** @enum {unknown} */
    SessionState: 'Active' | 'Ended';
    SetupRequest: {
      email: string;
      password: string;
      displayName: null | string;
      platformName: null | string;
      customerTenantId: string;
      customerName: string;
      customerAdminEmail: string;
      customerAdminPassword: string;
      customerAdminDisplayName: null | string;
    };
    SkillDto: {
      name: string;
      category: null | string;
      description: null | string;
    };
    SlaPolicyTarget: {
      /** Format: int32 */
      answerWithinSeconds?: null | number | string;
      /** Format: int32 */
      firstResponseWithinSeconds?: null | number | string;
      /** Format: int32 */
      resolutionWithinSeconds?: null | number | string;
    };
    SlaPolicyTargetDto: {
      /** Format: int32 */
      answerWithinSeconds?: null | number | string;
      /** Format: int32 */
      firstResponseWithinSeconds?: null | number | string;
      /** Format: int32 */
      resolutionWithinSeconds?: null | number | string;
    };
    /**
     * @description c2 — open (drawable) remaining credit for one CreditSource, surfaced as the enum name. The Σ of
     *     Remaining over a SourceRemainingResponse reconciles to the tenant's balance.
     */
    SourceRemainingDto: {
      /** @description Economic source name (`Subscription`, `TopUp`, `Promo`, `Partner`). */
      source: string;
      /**
       * Format: double
       * @description Open, non-expired remaining credit for this source.
       */
      remaining: number | string;
    };
    /** @description c2 — the per-source open-remaining breakdown for the resolved tenant (Σ == balance). */
    SourceRemainingResponse: {
      /** @description One line per source with open remaining; sources with zero open remaining are omitted. */
      sources: components['schemas']['SourceRemainingDto'][];
    };
    StatusUpdateResponse: {
      id: string;
      status: string;
    };
    StuckConversationDto: {
      conversationId: string;
      channel: string;
      state: string;
      ownerAgentId: string;
      ownerAgentName: string;
      /** Format: date-time */
      ownerOfflineSince: null | string;
      /** Format: int32 */
      failoverAttempts: number | string;
      escalated: boolean;
    };
    /**
     * @description How a TypificationSubmission was produced.
     * @enum {unknown}
     */
    SubmissionSource: 'Manual' | 'AutoAi' | 'Rule';
    SuggestionLogRowDto: {
      /** Format: int64 */
      id: number | string;
      sessionId: string;
      tenantId: string;
      /** Format: date-time */
      emittedAt: string;
      priority: string;
      source: string;
      triggerPhrase: null | string;
      suggestionText: string;
      whispered: boolean;
    };
    SupervisorCloseRequest: {
      reason: null | string;
    };
    SurveyDto: {
      id: string;
      name: string;
      type: string;
      questions: components['schemas']['SurveyQuestionDto'][];
      isActive: boolean;
    };
    SurveyQuestionDto: {
      text: string;
      type: components['schemas']['SurveyQuestionType'];
      options?: null | string[];
    };
    /**
     * @description Question answer format.
     * @enum {unknown}
     */
    SurveyQuestionType: 'Scale' | 'FreeText' | 'Choice';
    /** @description Aggregated score metrics for a survey. */
    SurveyScoreSummary: {
      /** Format: int32 */
      totalResponses: number | string;
      /** Format: double */
      averageScore: number | string;
      /** Format: int32 */
      promoters: null | number | string;
      /** Format: int32 */
      passives: null | number | string;
      /** Format: int32 */
      detractors: null | number | string;
      /** Format: double */
      npsScore: null | number | string;
    };
    /**
     * @description Survey classification — determines scoring logic.
     * @enum {unknown}
     */
    SurveyType: 'Csat' | 'Nps' | 'Custom';
    SuspendCustomerRequest: {
      reason: string;
    };
    SystemInfoDto: {
      version: string;
      hostTenantId: null | string;
      platformName: null | string;
      features: {
        [key: string]: boolean;
      };
    };
    SystemSettingsDto: {
      platformName: string;
      defaultTimezone: string;
      defaultLanguage: string;
    };
    SystemSettingsRequest: {
      platformName: string;
      defaultTimezone: string;
      defaultLanguage: string;
    };
    TeamDto: {
      id: string;
      name: string;
      /** Format: int32 */
      memberCount: number | string;
      /** Format: date-time */
      createdAt: string;
    };
    /**
     * @description HTTP-surface projection of TenantAuthConfig that is safe to
     *     emit to any caller satisfying `AdminOnly`. Closes
     *     `PREPUB-2026-05-09-ADMIN-001`: the OIDC client secret is NEVER
     *     returned in HTTP responses.
     */
    TenantAuthConfigResponse: {
      tenantId: string;
      mfaPolicy: string;
      mfaRequiredRoles: string[];
      /** Format: int32 */
      passwordMinLength: number | string;
      passwordRequireUppercase: boolean;
      passwordRequireNumber: boolean;
      passwordRequireSpecial: boolean;
      /** Format: int32 */
      lockoutThreshold: number | string;
      /** Format: int32 */
      lockoutDurationMinutes: number | string;
      /** Format: int32 */
      sessionIdleTimeoutMinutes: number | string;
      /** Format: int32 */
      sessionAbsoluteTimeoutHours: number | string;
      oidcEnabled: boolean;
      oidcAuthority: null | string;
      oidcClientId: null | string;
      oidcClientSecretSet: boolean;
      oidcClientSecretFingerprint: null | string;
      oidcAutoCreateUsers: boolean;
      oidcDefaultRole: string;
      /** Format: int32 */
      impersonationMaxConcurrentSessions: number | string;
      /** Format: int32 */
      impersonationAutoTimeoutMinutes: number | string;
      ipAllowlistEnabled: boolean;
      /** Format: date-time */
      updatedAt: null | string;
    };
    TenantChannelConfig: {
      tenantId: components['schemas']['TenantId'];
      channel: components['schemas']['ChannelType'];
      credentials: {
        [key: string]: string;
      };
      isActive?: boolean;
    };
    TenantId: unknown;
    /**
     * @description HTTP-safe projection of a tenant's TenantLlmConfig (P2c.1). The decrypted API key
     *     is NEVER returned: it is masked to bool TenantLlmConfigResponse.KeySet (is a key configured?) +
     *     string? TenantLlmConfigResponse.KeyLast4 (a non-secret display hint), mirroring the
     *     `TenantAuthConfigResponse` reveal-once/fingerprint idiom.
     */
    TenantLlmConfigResponse: {
      /** @description The provider family discriminator (`OpenAiCompatible` / `AzureOpenAi` / `Anthropic`). */
      providerType: components['schemas']['ProviderType'];
      /** @description The configured model identifier. */
      model: string;
      /** @description Type-specific (non-secret) provider settings. */
      settings: components['schemas']['ProviderSettings'];
      /** @description Whether AI is enabled for this tenant. */
      enabled: boolean;
      /** @description BYO (tenant key) vs platform-managed (Verbara operator key, metered in AI Credits). */
      aiSource: components['schemas']['AiSource'];
      /** @description Whether the tenant's plan entitles it to the platform-managed LLM (`PlanFeature.PlatformLlm`). */
      platformLlmAvailable: boolean;
      /** @description Whether an API key is currently stored (the key value is never returned). */
      keySet: boolean;
      /** @description Last 4 chars of the stored key (non-secret display hint), or `null`. */
      keyLast4: null | string;
      /**
       * Format: date-time
       * @description UTC timestamp of the most recent upsert.
       */
      updatedAt: string;
    };
    /** @enum {unknown} */
    TenantPlan: 'Starter' | 'Pro' | 'Enterprise' | null;
    TenantRole: {
      roleId: string;
      tenantId: components['schemas']['TenantId'];
      name: string;
      description?: null | string;
      sourceTemplateId?: null | string;
      isDefault?: boolean;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt?: null | string;
      permissions?: null | string[];
    };
    TenantSettingsDto: {
      tenantId: string;
      name: string;
      type: string;
      status: string;
      operational: components['schemas']['OperationalSettingsDto'];
      auth: components['schemas']['AuthSettingsDto'];
      quotas: components['schemas']['QuotaSettingsDto'];
      retention: components['schemas']['RetentionSettingsDto'];
      rateLimitTier: components['schemas']['RateLimitTier'];
      plan: string;
      enabledFeatures: string[];
      addOns: string[];
      dunning: null | components['schemas']['DunningStatusDto'];
      branding: null | components['schemas']['BrandingSettingsDto'];
    };
    /**
     * @default Customer
     * @enum {unknown}
     */
    TenantType: 'Platform' | 'Partner' | 'Customer';
    /**
     * @description "Test connection" request (P2c.1, `POST /admin/ai/llm-config/test`). When all fields are
     *     `null` the SAVED config is probed; otherwise a DRAFT config is built from the
     *     body and probed in-memory only (its key is never persisted or logged).
     */
    TestLlmConnectionRequest: {
      providerType: null | components['schemas']['ProviderType'];
      /** @description Draft model identifier. */
      model: null | string;
      /**
       * @description Draft plaintext API key, used only in-memory for the probe. When `null`/empty on
       *     a draft probe of a tenant that already has a stored key, the stored key is reused for the probe.
       */
      apiKey: null | string;
      settings: null | components['schemas']['ProviderSettings'];
    };
    /**
     * @description "Test connection" result (P2c.1). A reachable provider that accepted the credentials and
     *     returned a completion for the configured model is fully green (bool TestLlmConnectionResponse.Reachable +
     *     bool TestLlmConnectionResponse.AuthOk + bool TestLlmConnectionResponse.ModelOk all `true`).
     */
    TestLlmConnectionResponse: {
      /** @description The endpoint was reachable (the HTTP request completed without a transport failure). */
      reachable: boolean;
      /** @description The credentials were accepted (no 401/403). */
      authOk: boolean;
      /** @description The model produced a completion (the request succeeded end-to-end). */
      modelOk: boolean;
      /**
       * Format: int64
       * @description Round-trip latency of the probe in milliseconds.
       */
      latencyMs: number | string;
      /** @description A short, secret-free error summary when the probe failed; `null` on success. */
      error: null | string;
    };
    TopicDto: {
      name: string;
      /** Format: float */
      confidence: number | string;
    };
    TopicTrendDto: {
      topic: string;
      /** Format: int32 */
      occurrences: number | string;
      /** Format: double */
      avgConfidence: number | string;
    };
    TopicTrendsResponse: {
      trends: components['schemas']['TopicTrendDto'][];
      /** Format: int32 */
      totalAnalyzed: number | string;
    };
    /**
     * @description c1 — operator top-up request body. Mints a fungible CreditSource.TopUp grant for
     *     TenantId of Amount credits, idempotent on
     *     IdempotencyKey (→ the ledger entry's `external_ref`).
     */
    TopUpRequest: {
      /** @description Target tenant the credits are minted onto. */
      tenantId: string;
      /**
       * Format: double
       * @description Positive credit amount to grant.
       */
      amount: number | string;
      /** @description Caller-supplied idempotency key; a repeat is a no-op. */
      idempotencyKey: string;
    };
    TransferRequest: {
      targetQueueId: null | string;
      targetAgentId: null | string;
    };
    TrendPointDto: {
      label: string;
      /** Format: double */
      value: number | string;
    };
    TurnSentimentDto: {
      /** Format: int32 */
      turnIndex: number | string;
      speaker: string;
      /** Format: float */
      score: number | string;
      label: string;
    };
    /**
     * @description Server-authoritative delivery band for an AI typification suggestion (C1, P2b).
     *     The client MUST NOT escalate the band — the server decides.
     * @default None
     * @enum {unknown}
     */
    TypificationBand: 'None' | 'Suggest' | 'AutoFill';
    /**
     * @description Request body for POST /conversations/{id}/typification-correction: the supervisor's corrected
     *     root→leaf node-id path. The last element is the corrected leaf. The correcting user id is taken
     *     from the caller's credentials, not the body.
     */
    TypificationCorrectionRequest: {
      correctedNodePath: string[];
    };
    /**
     * @description 200 payload for a successful correction: echoes the persisted (separate, append-only) correction
     *     record and whether the human path merely CONFIRMED the AI path (`original == corrected`).
     */
    TypificationCorrectionResponse: {
      conversationId: string;
      correctedNodePath: string[];
      correctedLeafNodeId: string;
      correctedByUserId: string;
      /** Format: date-time */
      correctedAt: string;
      confirmed: boolean;
    };
    TypificationFieldDto: {
      fieldId: string;
      key: string;
      label: string;
      type: string;
      required: boolean;
      options: null | components['schemas']['FieldOptionDto'][];
      validation: null | components['schemas']['FieldValidationDto'];
      attachToNodeId: null | string;
      visibleWhen: null | components['schemas']['ConditionExprDto'];
      prefillSource: null | components['schemas']['PrefillSourceDto'];
      /** Format: int32 */
      sortOrder: number | string;
    };
    /**
     * @description The resolved typification form for a conversation: the cascading schema, the
     *     optional sub-tree root, and the wrap-up PREFILL (C9) — a preselected reason node
     *     path (root→leaf node-id strings) and prefilled field values (keyed by field Key)
     *     derived from the conversation's captured context so the agent confirms instead of
     *     re-classifying. Both prefill members are `null` (not empty) when
     *     nothing is preselectable, so the client cleanly distinguishes "no prefill".
     */
    TypificationFormResponse: {
      schema: components['schemas']['TypificationSchemaDto'];
      subtreeRootNodeId: null | string;
      prefilledNodePath?: null | string[];
      prefilledFieldValues?: null | {
        [key: string]: string;
      };
    };
    TypificationNodeDto: {
      nodeId: string;
      parentNodeId: null | string;
      label: string;
      code: string;
      /** Format: int32 */
      sortOrder: number | string;
      isLeaf: boolean;
      channelApplicability: null | string[];
      leaf: null | components['schemas']['LeafOutcomeDto'];
    };
    TypificationSchemaDto: {
      schemaId: string;
      name: string;
      /** Format: int32 */
      version: number | string;
      isPublished: boolean;
      /** Format: int32 */
      maxDepth: number | string;
      nodes: components['schemas']['TypificationNodeDto'][];
      fields: components['schemas']['TypificationFieldDto'][];
      aiConfig: components['schemas']['AiConfigDto'];
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt: null | string;
    };
    /**
     * @description A completed typification for a conversation (replaces the disposition part of
     *     the old WrapUpRecord). Field values are typed-validated server-side.
     */
    TypificationSubmission: {
      tenantId: components['schemas']['TenantId'];
      conversationId: components['schemas']['EntityId'];
      agentId: components['schemas']['EntityId'];
      schemaId: components['schemas']['EntityId'];
      /** Format: int32 */
      schemaVersion?: number | string;
      /** @description root..leaf. */
      selectedNodePath: unknown[];
      leafNodeId: components['schemas']['EntityId'];
      /** @description key → value (typed-validated server-side). */
      fieldValues: {
        [key: string]: string;
      };
      notes?: null | string;
      aiSuggested?: boolean;
      /** Format: double */
      aiConfidence?: null | number | string;
      /** @description Did the agent keep the AI suggestion? */
      aiAccepted?: null | boolean;
      source?: components['schemas']['SubmissionSource'];
      suggestedLeafNodeId?: null | components['schemas']['EntityId'];
      /**
       * @description Full node path (root→leaf) the AI suggested (null when no suggestion exists).
       *     Captured for correction-signal analysis (B3).
       */
      suggestedNodePath?: null | string[];
      duration?: string;
      /** Format: date-time */
      completedAt?: string;
      /**
       * @description Identifier of the AI actor that autonomously stamped this disposition (e.g.
       *     `verbara:ai:autonomous-worker`), set only when SubmissionSource TypificationSubmission.Source is
       *     SubmissionSource.AutoAi on the abandoned-wrap-up close path. Null otherwise.
       */
      autonomousActorId?: null | string;
      /**
       * @description Append-only correction state. An autonomously stamped submission is immutable; a supervisor
       *     correction creates a new corrective submission and marks the original CorrectionState.Corrected.
       */
      correctionState?: components['schemas']['CorrectionState'];
      /**
       * Format: date-time
       * @description UTC timestamp at which this submission was corrected (null while uncorrected).
       */
      correctedAt?: null | string;
    };
    /**
     * @description D1 — AI auto-disposition suggestion (P2a/C1). The suggested root→leaf node-id path,
     *     optional captured field values, the model's confidence, a free-form sentiment hint,
     *     and the server-authoritative delivery TypificationBand. All members are
     *     `null` / TypificationBand.None (the all-null payload)
     *     when there is no suggestion — no bound schema, AI disabled, the classifier degraded,
     *     the confidence fell below the schema threshold, or a sentiment-gated Success outcome
     *     was suppressed.
     */
    TypificationSuggestionResponse: {
      suggestedNodePath: null | string[];
      suggestedFieldValues: null | {
        [key: string]: string;
      };
      /** Format: double */
      confidence: null | number | string;
      sentiment: null | string;
      band?: components['schemas']['TypificationBand'];
    };
    /** @description 400 payload when a runtime typify submission fails server validation. */
    TypifyErrorResponse: {
      errors: components['schemas']['TypifyFieldError'][];
    };
    TypifyFieldError: {
      field: string;
      message: string;
    };
    /**
     * @description Runtime typification submission: the selected root→leaf node path, the captured
     *     field values (key → value, typed-validated server-side), optional free-text notes,
     *     and AI provenance (P2 — null when no AI involved): whether the chosen path originated
     *     from an AI suggestion (AiSuggested → `Source = AutoAi`), the
     *     suggestion's confidence (AiConfidence), and whether the agent
     *     accepted the suggestion verbatim (AiAccepted).
     */
    TypifyRequest: {
      selectedNodePath: string[];
      fieldValues: {
        [key: string]: string;
      };
      notes?: null | string;
      aiAccepted?: null | boolean;
      aiSuggested?: null | boolean;
      /** Format: double */
      aiConfidence?: null | number | string;
    };
    UnreadCountDto: {
      /** Format: int32 */
      count: number | string;
    };
    UpdateAgentRequest: {
      displayName: null | string;
      teamId: null | string;
      skills: null | string[];
      extension?: null | string;
      sipPassword?: null | string;
      autoAnswer?: null | boolean;
      capacity?: null | components['schemas']['ChannelCapacityOverrideDto'];
    };
    UpdateAgentStateRequest: {
      state: components['schemas']['AgentState'];
      reason?: null | string;
    };
    UpdateArticleRequest: {
      title?: null | string;
      content?: null | string;
      tags?: null | string[];
      isPublished?: null | boolean;
      language?: null | string;
    };
    UpdateAuthSettingsDto: {
      mfaPolicy?: null | string;
      mfaRequiredRoles?: null | string[];
      /** Format: int32 */
      passwordMinLength?: null | number | string;
      passwordRequireUppercase?: null | boolean;
      passwordRequireNumber?: null | boolean;
      passwordRequireSpecial?: null | boolean;
      /** Format: int32 */
      lockoutThreshold?: null | number | string;
      /** Format: int32 */
      lockoutDurationMinutes?: null | number | string;
      /** Format: int32 */
      sessionIdleTimeoutMinutes?: null | number | string;
      /** Format: int32 */
      sessionAbsoluteTimeoutHours?: null | number | string;
      oidcEnabled?: null | boolean;
      oidcAuthority?: null | string;
      oidcClientId?: null | string;
      oidcClientSecret?: null | string;
      oidcAutoCreateUsers?: null | boolean;
      oidcDefaultRole?: null | string;
      /** Format: int32 */
      impersonationMaxConcurrentSessions?: null | number | string;
      /** Format: int32 */
      impersonationAutoTimeoutMinutes?: null | number | string;
      ipAllowlistEnabled?: null | boolean;
    };
    UpdateBindingRequest: {
      scope: string;
      scopeRef: null | string;
      schemaId: string;
      subtreeRootNodeId: null | string;
      /** Format: int32 */
      priority: number | string;
      aiConfigOverride?: null | components['schemas']['AiConfigDto'];
    };
    UpdateBotRequest: {
      name?: null | string;
      defaultFlowId?: null | string;
      fallbackQueueId?: null | string;
      /** Format: double */
      confidenceThreshold?: null | number | string;
      /** Format: int32 */
      maxTurns?: null | number | string;
      isActive?: null | boolean;
    };
    UpdateBrandingSettingsDto: {
      displayName?: null | string;
      logoUrl?: null | string;
      faviconUrl?: null | string;
      primaryColor?: null | string;
      secondaryColor?: null | string;
      accentColor?: null | string;
      locale?: null | string;
      timezone?: null | string;
      supportEmail?: null | string;
      supportUrl?: null | string;
      emailFromName?: null | string;
      emailFromAddress?: null | string;
    };
    UpdateCallAttemptDispositionRequest: {
      /** Format: int64 */
      dispositionId: number | string;
      agentComment: null | string;
    };
    UpdateCallerIdPoolRequest: {
      name: null | string;
    };
    UpdateCampaignRequest: {
      name: null | string;
      description: null | string;
      targetQueueName: null | string;
      teamId: null | string;
      /** Format: int32 */
      maxConcurrentCalls: null | number | string;
      /** Format: double */
      powerRatio: null | number | string;
      /** Format: double */
      targetAbandonRate: null | number | string;
      timezone: null | string;
      campaignStart: null | string;
      campaignEnd: null | string;
      schedule: null | components['schemas']['ScheduleDayDto'][];
      holidays: null | string[];
      dncEnabled: null | boolean;
      /** Format: int32 */
      maxAttemptsPerContact: null | number | string;
      /** Format: int32 */
      retryIntervalMinutes: null | number | string;
      /** Format: int32 */
      timeBetweenAttemptsMinutes: null | number | string;
      complianceNotes: null | string;
    };
    UpdateCannedResponseRequest: {
      shortcut: null | string;
      title: null | string;
      body: null | string;
      category: null | string;
      tags: null | string[];
    };
    UpdateCaseRequest: {
      subject: null | string;
      status: null | string;
      priority: null | string;
      assignedAgentId: null | string;
    };
    UpdateChannelConfigRequest: {
      isActive: boolean;
      credentials: null | {
        [key: string]: string;
      };
    };
    UpdateContactRequest: {
      firstName?: null | string;
      lastName?: null | string;
      company?: null | string;
      segment?: null | string;
      preferredChannel?: null | components['schemas']['ChannelType'];
      preferredLanguage?: null | string;
      timezone?: null | string;
      doNotContact?: null | boolean;
      addresses?: null | components['schemas']['ChannelAddressDto'][];
      customFields?: null | {
        [key: string]: string;
      };
    };
    UpdateDialerSettingsRequest: {
      /** Format: int32 */
      maxGlobalChannels: null | number | string;
      /** Format: int32 */
      defaultRingTimeoutSeconds: null | number | string;
      /** Format: int32 */
      campaignPollIntervalSeconds: null | number | string;
      /** Format: int32 */
      maxConcurrentCampaigns: null | number | string;
      blendModeEnabled: null | boolean;
      /** Format: int32 */
      jitterMinMs: null | number | string;
      /** Format: int32 */
      jitterMaxMs: null | number | string;
      /** Format: int32 */
      ahtCacheDurationSeconds: null | number | string;
      /** Format: int32 */
      scheduledCallbackPollSeconds: null | number | string;
    };
    UpdateDidRouteRequest: {
      did: null | string;
      queueId: null | string;
      isActive: null | boolean;
    };
    UpdateDispositionCodeRequest: {
      label: null | string;
      category: null | string;
      isSuccess: null | boolean;
      triggerRetry: null | boolean;
      /** Format: int32 */
      retryDelayMinutes: null | number | string;
      triggerCallback: null | boolean;
      isActive: null | boolean;
      /** Format: int32 */
      sortOrder: null | number | string;
    };
    UpdateDncListRequest: {
      name: null | string;
      scope: null | string;
    };
    UpdateEndpointProfileRequest: {
      name: null | string;
      transport: null | string;
      codecs: null | string;
      webrtc: null | boolean;
      /** Format: int32 */
      maxContacts: null | number | string;
      isDefault: null | boolean;
      directMedia: null | boolean;
      context: null | string;
      /** Format: int32 */
      qualifyFrequency: null | number | string;
    };
    UpdateFlowRequest: {
      name?: null | string;
      entryNodeId?: null | string;
      nodes?: null | components['schemas']['FlowNodeDto'][];
    };
    UpdateHolidayCalendarRequest: {
      name: null | string;
    };
    UpdateLicenseRequest: {
      licenseKey: string;
    };
    UpdateManagementBrandingSettingsDto: {
      displayName?: null | string;
      logoUrl?: null | string;
      faviconUrl?: null | string;
      primaryColor?: null | string;
      secondaryColor?: null | string;
      accentColor?: null | string;
      locale?: null | string;
      timezone?: null | string;
      subdomain?: null | string;
      supportEmail?: null | string;
      supportUrl?: null | string;
      emailFromName?: null | string;
      emailFromAddress?: null | string;
    };
    /**
     * @description PATCH body for queue-member updates. PATCH semantics for AllowedChannels:
     *     `ClearAllowedChannels=true` resets to NULL (= all channels);
     *     `AllowedChannels` populated replaces existing list; both omitted
     *     preserves existing value.
     */
    UpdateMemberBody: {
      /** Format: int32 */
      penalty: null | number | string;
      isExcluded: null | boolean;
      allowedChannels?: null | string[];
      clearAllowedChannels?: null | boolean;
    };
    UpdateMgmtTenantRequest: {
      name?: null | string;
      status?: null | string;
      /** Format: int32 */
      maxConcurrentChannels?: null | number | string;
      /** Format: int32 */
      maxActiveCampaigns?: null | number | string;
      metadata?: null | {
        [key: string]: string;
      };
    };
    UpdateNodeRequest: {
      /** Format: double */
      weight: null | number | string;
      /** Format: int32 */
      priorityTier: null | number | string;
      /** Format: int32 */
      maxCapacity: null | number | string;
      tags: null | {
        [key: string]: string;
      };
    };
    UpdateOperationalSettingsDto: {
      /** Format: int32 */
      maxConcurrentChannels?: null | number | string;
      /** Format: int32 */
      maxActiveCampaigns?: null | number | string;
      dialplanContextPrefix?: null | string;
      nodeAffinity?: null | string[];
      allowedDialingModes?: null | (number | string)[];
      outboundCallerId?: null | string;
      /** Format: int32 */
      maxVoiceDefault?: null | number | string;
      /** Format: int32 */
      maxChatDefault?: null | number | string;
      /** Format: int32 */
      maxEmailDefault?: null | number | string;
      /** Format: int32 */
      maxSmsDefault?: null | number | string;
      /** Format: int32 */
      maxTotalDefault?: null | number | string;
    };
    UpdateOutboundRouteRequest: {
      /** Format: int64 */
      campaignId: null | number | string;
      pattern: null | string;
      patternType: null | string;
      /** Format: int64 */
      trunkId: null | number | string;
      /** Format: int64 */
      overflowTrunkId: null | number | string;
      dialPrefix: null | string;
      /** Format: int32 */
      priority: null | number | string;
    };
    UpdatePartnerCustomerRequest: {
      name?: null | string;
      /** Format: int32 */
      maxConcurrentChannels?: null | number | string;
      /** Format: int32 */
      maxActiveCampaigns?: null | number | string;
    };
    UpdateQueueRequest: {
      name?: null | string;
      isActive?: null | boolean;
      slaTargets?: null | components['schemas']['SlaPolicyTargetDto'];
      overflowRule?: null | components['schemas']['QueueOverflowRuleDto'];
      wrapUp?: null | components['schemas']['WrapUpConfigDto'];
      /** Format: int32 */
      maxWaiting?: null | number | string;
      requiredSkills?: null | string[];
      autoAnswerDefault?: null | boolean;
    };
    UpdateQuotaRequest: {
      /** Format: int32 */
      maxConcurrentChannels?: null | number | string;
      /** Format: int32 */
      maxActiveCampaigns?: null | number | string;
      /** Format: int64 */
      maxMonthlyVoiceMinutes?: null | number | string;
      /** Format: int64 */
      maxMonthlyMessages?: null | number | string;
      /** Format: int64 */
      maxStorageBytes?: null | number | string;
      /** Format: int32 */
      maxActiveAgents?: null | number | string;
      quotaAction?: null | string;
    };
    UpdateQuotaSettingsDto: {
      /** Format: int64 */
      maxMonthlyVoiceMinutes?: null | number | string;
      /** Format: int64 */
      maxMonthlyMessages?: null | number | string;
      /** Format: int64 */
      maxStorageBytes?: null | number | string;
      /** Format: int32 */
      maxActiveAgents?: null | number | string;
      quotaAction?: null | string;
    };
    UpdateReasonHintRequest: {
      scope: null | string;
      scopeRef: null | string;
      reasonPath: null | string;
      /** Format: int32 */
      priority: null | number | string;
      isActive: null | boolean;
    };
    UpdateRetentionPolicyRequest: {
      /** Format: int32 */
      conversationRetentionDays: null | number | string;
      /** Format: int32 */
      authEventRetentionDays: null | number | string;
      /** Format: int32 */
      auditRetentionDays: null | number | string;
      /** Format: int32 */
      usageRecordRetentionDays: null | number | string;
    };
    UpdateRetentionSettingsDto: {
      /** Format: int32 */
      conversationRetentionDays?: null | number | string;
      /** Format: int32 */
      authEventRetentionDays?: null | number | string;
      /** Format: int32 */
      auditRetentionDays?: null | number | string;
      /** Format: int32 */
      usageRecordRetentionDays?: null | number | string;
    };
    UpdateScheduledReportRequest: {
      name?: null | string;
      type?: null | string;
      schedule?: null | string;
      filters?: null | string;
      recipients?: null | string;
      format?: null | string;
      isActive?: null | boolean;
      reportType?: null | string;
      effectiveType?: null | string;
    };
    UpdateSchemaRequest: {
      name: string;
      /** Format: int32 */
      maxDepth: number | string;
      nodes: components['schemas']['TypificationNodeDto'][];
      fields: components['schemas']['TypificationFieldDto'][];
      aiConfig?: null | components['schemas']['AiConfigDto'];
    };
    UpdateSurveyRequest: {
      name?: null | string;
      type?: null | components['schemas']['SurveyType'];
      questions?: null | components['schemas']['SurveyQuestionDto'][];
      isActive?: null | boolean;
    };
    UpdateTeamRequest: {
      name: null | string;
    };
    UpdateTenantAuthConfigRequest: {
      mfaPolicy?: null | string;
      mfaRequiredRoles?: null | string[];
      /** Format: int32 */
      passwordMinLength?: null | number | string;
      passwordRequireUppercase?: null | boolean;
      passwordRequireNumber?: null | boolean;
      passwordRequireSpecial?: null | boolean;
      /** Format: int32 */
      lockoutThreshold?: null | number | string;
      /** Format: int32 */
      lockoutDurationMinutes?: null | number | string;
      /** Format: int32 */
      sessionIdleTimeoutMinutes?: null | number | string;
      /** Format: int32 */
      sessionAbsoluteTimeoutHours?: null | number | string;
      oidcEnabled?: null | boolean;
      oidcAuthority?: null | string;
      oidcClientId?: null | string;
      oidcClientSecret?: null | string;
      oidcAutoCreateUsers?: null | boolean;
      oidcDefaultRole?: null | string;
    };
    UpdateTenantRoleRequest: {
      name?: null | string;
      description?: null | string;
      permissions?: null | string[];
    };
    UpdateTenantSettingsRequest: {
      operational?: null | components['schemas']['UpdateOperationalSettingsDto'];
      auth?: null | components['schemas']['UpdateAuthSettingsDto'];
      quotas?: null | components['schemas']['UpdateQuotaSettingsDto'];
      retention?: null | components['schemas']['UpdateRetentionSettingsDto'];
      rateLimitTier?: null | components['schemas']['RateLimitTier'];
      plan?: null | components['schemas']['TenantPlan'];
      addOns?: null | components['schemas']['PlanFeature'][];
      branding?: null | components['schemas']['UpdateBrandingSettingsDto'];
    };
    UpdateTrunkRequest: {
      name: null | string;
      displayName: null | string;
      type: null | string;
      isActive: null | boolean;
      /** Format: int32 */
      maxChannels: null | number | string;
      transport: null | string;
      codecs: null | string;
      authUsername: null | string;
      authPassword: null | string;
      registrationUri: null | string;
      clientUri: null | string;
      context: null | string;
      matchHost: null | string;
    };
    UpdateUserRequest: {
      displayName: null | string;
      role: null | components['schemas']['UserRole'];
      status: null | components['schemas']['UserStatus'];
    };
    UpdateWebhookSubscriptionRequest: {
      name: null | string;
      endpointUrl: null | string;
      eventTypes: null | string[];
      isActive: null | boolean;
    };
    /**
     * @description Admin upsert body for a per-tenant CSAT prompt template (csat-runner Phase E,
     *     `PUT /api/v1/admin/csat/templates/{id}`). The template id is path-bound, not in the
     *     body. Typed sealed record registered in `ApiJsonContext` (Native AOT, no reflection).
     */
    UpsertCsatTemplateRequest: {
      /** @description The channel the prompt is for: `voice`, `email`, or `sms`. */
      channel: string;
      /** @description The template locale (BCP-47, e.g. `en-US`). */
      locale: string;
      /** @description The prompt body — the email message, SMS text, or voice TTS prompt. */
      body: string;
      /** @description Subject line for channels that carry one (email); null otherwise. */
      subject?: null | string;
      /**
       * @description Whether this is a tenant default for its `(channel, locale)`. When omitted, an update
       *     keeps the existing flag and a create defaults to `false`.
       */
      isDefault?: null | boolean;
    };
    /** @description Upsert request for a tenant's LLM config (P2c.1, `PUT /admin/ai/llm-config`). */
    UpsertLlmConfigRequest: {
      /** @description The provider family to configure. */
      providerType: components['schemas']['ProviderType'];
      /** @description The model identifier (e.g. `gpt-4o-mini`). */
      model: string;
      /**
       * @description The plaintext API key. When `null` or empty on a tenant that already has a
       *     stored key, the stored key is PRESERVED (the masked GET never round-trips the real key, so the
       *     Web client omits it on edits that don't rotate the key). A non-empty value sets/rotates the key.
       */
      apiKey: null | string;
      settings: null | components['schemas']['ProviderSettings'];
      /** @description Whether AI is enabled for this tenant. */
      enabled: boolean;
      /**
       * @description BYO (tenant key, default) vs platform-managed (Verbara operator key, metered in AI Credits).
       *     Defaulted to AiSource.Byo so existing BYO callers stay source-compatible.
       *     AiSource.PlatformManaged requires the `PlanFeature.PlatformLlm` entitlement.
       */
      aiSource?: components['schemas']['AiSource'];
    };
    UpsertSkillRequest: {
      category: null | string;
      description: null | string;
    };
    UsageRecordDto: {
      recordId: string;
      usageType: string;
      /** Format: double */
      quantity: number | string;
      unit: string;
      channel: null | string;
      referenceId: null | string;
      /** Format: date-time */
      recordedAt: string;
    };
    UsageSummaryDto: {
      usageType: string;
      /** Format: double */
      totalQuantity: number | string;
      /** Format: int32 */
      recordCount: number | string;
      /** Format: date-time */
      periodStart: string;
      /** Format: date-time */
      periodEnd: string;
      /** Format: date-time */
      lastUpdatedAt: string;
    };
    UserDto: {
      id: string;
      email: string;
      displayName: string;
      role: string;
      status: string;
      /** Format: date-time */
      createdAt: string;
    };
    UserPermissionsDto: {
      userId: string;
      permissions: string[];
    };
    /** @description Preview of entities that would be affected by a user purge operation. */
    UserPurgePreview: {
      userId: string;
      tenantId: string;
      /** Format: int32 */
      authEventCount: number | string;
      /** Format: int32 */
      auditTrailCount: number | string;
      /** Format: date-time */
      previewedAt: string;
    };
    /** @enum {unknown} */
    UserRole: 'Agent' | 'Supervisor' | 'Admin' | 'Api';
    UserRoleAssignment: {
      tenantId: components['schemas']['TenantId'];
      userId: components['schemas']['EntityId'];
      roleId: string;
      /** Format: date-time */
      assignedAt: string;
      assignedBy?: null | string;
    };
    /** @enum {unknown} */
    UserStatus: 'Active' | 'Suspended' | 'Deactivated' | null;
    /**
     * @description Codec catalog returned by `GET /api/v1/admin/voice/codecs`.
     *     Source is `"asterisk"` when the list came from a live `core show codecs`
     *     query, or `"fallback"` when Asterisk could not be reached (static catalog).
     */
    VoiceCodecsResponse: {
      source: string;
      codecs: string[];
    };
    /** @description Click-to-dial request (3B.2d): dial `ToNumber`, or resolve the number from `ContactId`. */
    VoiceDialRequest: {
      toNumber: null | string;
      contactId: null | string;
    };
    /** @description `CorrelationId` is the tracked outbound Conversation id on success; `Error` a stable code otherwise. */
    VoiceDialResponse: {
      accepted: boolean;
      correlationId: null | string;
      error: null | string;
    };
    /** @description Blind-transfer request: `Kind` = "queue"|"agent", `Target` = the queue/agent id. */
    VoiceTransferRequest: {
      kind: string;
      target: string;
    };
    /** @description `Error` is a stable machine code (e.g. "channel-unknown", "not-owner") on failure. */
    VoiceTransferResponse: {
      accepted: boolean;
      error: null | string;
    };
    WebChatMessageRequest: {
      text: string;
    };
    WebhookDelivery: {
      deliveryId: string;
      tenantId: string;
      subscriptionId: string;
      eventType: string;
      payload: string;
      status: components['schemas']['WebhookDeliveryStatus'];
      /** Format: int32 */
      attempts: number | string;
      /** Format: int32 */
      maxAttempts: number | string;
      /** Format: date-time */
      nextRetryAt: null | string;
      /** Format: int32 */
      lastResponseCode: null | number | string;
      lastError: null | string;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      deliveredAt: null | string;
    };
    /** @enum {unknown} */
    WebhookDeliveryStatus: 'Pending' | 'Delivered' | 'Failed' | 'DeadLetter';
    WebhookSubscription: {
      subscriptionId: string;
      tenantId: string;
      name: string;
      endpointUrl: string;
      secret: string;
      eventTypes: string[];
      isActive: boolean;
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt: string;
      circuitStatus?: components['schemas']['CircuitStatus'];
      /**
       * Format: int32
       * @default 0
       */
      circuitFailures: number | string;
      /** Format: date-time */
      circuitOpenedAt?: null | string;
      /** Format: date-time */
      circuitNextProbeAt?: null | string;
      /**
       * Format: int32
       * @default 0
       */
      circuitProbeAttempts: number | string;
    };
    WhisperRequest: {
      text: string;
    };
    WrapUpConfig: {
      /** Format: int32 */
      defaultWrapUpSeconds?: number | string;
      forceWrapUp?: boolean;
    };
    WrapUpConfigDto: {
      /**
       * Format: int32
       * @default 30
       */
      defaultWrapUpSeconds: number | string;
      /** @default false */
      forceWrapUp: boolean;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
