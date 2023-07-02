import { procedure, router } from "../trpc";
import { z } from "zod";
import { isPermitted, zRoles } from "../../shared/Role";
import User from "../database/models/User";
import { TRPCError } from "@trpc/server";
import { Op } from "sequelize";
import { presentPublicUser } from "../../shared/PublicUser";
import { authUser, invalidateLocalUserCache } from "../auth";
import pinyin from 'tiny-pinyin';
import { zUserProfile } from "shared/UserProfile";
import { isValidChineseName } from "../../shared/utils/string";
import invariant from 'tiny-invariant';

const users = router({
  create: procedure
  .use(authUser('UserManager'))
  .input(z.object({
    name: z.string().min(1, "required"),
    pinyin: z.string(),
    email: z.string().email(),
    clientId: z.string().min(1, "required"),
    roles: zRoles.min(1, "required"),
  }))
  .mutation(async ({ input, ctx }) => {
    const user = await User.findOne({
      where: {
        clientId: input.clientId
      }
    });

    if (user) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'this user is already created in our db',
      });
    }

    await User.create({
      name: input.name,
      pinyin: input.pinyin,
      email: input.email,
      roles: input.roles,
      clientId: input.clientId
    });

    return 'ok' as const;
  }),

  search: procedure
  .use(authUser('UserManager'))
  .input(z.object({ query: z.string() }))
  .query(async ({ input }) => {
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { pinyin: { [Op.iLike]: `%${input.query}%` } },
          { name: { [Op.iLike]: `%${input.query}%` } },
          { email: { [Op.iLike]: `%${input.query}%` } },
        ],
      }
    });

    return {
      users: users.map(presentPublicUser),
    }
  }),

  list: procedure
  .use(authUser('UserManager'))
  .output(z.array(zUserProfile))
  .query(async () => await User.findAll({ order: [['pinyin', 'ASC']] })),

  /**
   * In Edge or Serverless environments, user profile updates may take up to auth.USER_CACHE_TTL_IN_MS to propagate.
   * TODO: add a warning message in profile change UI.
   */
  update: procedure
  .use(authUser())
  .input(zUserProfile)
  .mutation(async ({ input, ctx }) => {
    const isUserManager = isPermitted(ctx.user.roles, 'UserManager');
    const isSelf = ctx.user.id === input.id;
    // Anyone can update user profiles, but non-UserManagers can only update their own.
    if (!isUserManager && !isSelf) {
      throw new TRPCError({
        code: 'FORBIDDEN',
      })
    }
    if (!isValidChineseName(input.name)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid user name.'
      })
    }
    invariant(input.name);

    const user = await User.findByPk(input.id);
    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `User ${input.id} not found.`
      });
    }

    user.update({
      name: input.name,
      pinyin: pinyin.convertToPinyin(input.name),
      consentFormAcceptedAt: input.consentFormAcceptedAt,
      ...isUserManager ? {
        roles: input.roles,
        email: input.email,
      } : {},
    });
    invalidateLocalUserCache();
  })
});

export default users;
