import {
  Box,
  Button,
  ModalContent,
  ModalHeader,
  ModalBody,
  StackDivider,
  Text,
  VStack,
  FormLabel,
  Input,
  FormControl,
  Link,
  Alert,
  HStack,
  AlertIcon,
  AlertDescription,
  UnorderedList,
  ListItem,
} from '@chakra-ui/react';
import React, { useState } from 'react';
import { useUserContext } from "../UserContext";
import trpc from "../trpc";
import { trpcNext } from "../trpc";
import GroupBar from 'components/GroupBar';
import PageBreadcrumb from 'components/PageBreadcrumb';
import ConsentModal, { consentFormAccepted } from '../components/ConsentModal';
import ModalWithBackdrop from 'components/ModalWithBackdrop';
import { isValidChineseName } from '../shared/strings';
import Loader from 'components/Loader';
import { isPermitted } from 'shared/Role';
import { componentSpacing, paragraphSpacing } from 'theme/metrics';

export default function Page() {
  const [user] = useUserContext();
  const hasName = !!user.name;
  return <>
    {hasName ? <Groups /> : <SetNameModal />}
    {hasName && !consentFormAccepted(user) && <ConsentModal />}
  </>;
};

Page.title = "我的会议";

function SetNameModal() {
  const [user, setUser] = useUserContext();
  const [name, setName] = useState(user.name || '');
  const handleSubmit = async () => {
    if (name) {
      const updated = {
        ...user,
        name,
      };
      await trpc.users.update.mutate(updated);
      setUser(updated);
    };
  };

  return (
    // onClose returns undefined to prevent user from closing the modal without
    // entering name.
    <ModalWithBackdrop isOpen onClose={() => undefined}>
      <ModalContent>
        <ModalHeader>欢迎你，新用户 👋</ModalHeader>
        <ModalBody>
          <Box mt={4}>
            <FormControl>
              <FormLabel>请填写中文全名</FormLabel>
              <Input
                isRequired={true}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='请勿使用英文或其他符号'
                mb='24px'
              />
              <Button
                onClick={handleSubmit}
                isDisabled={!isValidChineseName(name)}
                variant='brand' w='100%' mb='24px'>
                提交
              </Button>
            </FormControl>
          </Box>
        </ModalBody>
      </ModalContent>
    </ModalWithBackdrop>
  );
}

function Groups() {
  const [me] = useUserContext();
  const { data: groups, isLoading } = trpcNext.groups.listMine.useQuery({
    // TODO: This is a hack. Do it properly.
    includeOwned: isPermitted(me.roles, "Mentee"),
  });

  return (<>
    <PageBreadcrumb current='我的会议' parents={[]} />

    {isLoading && <Loader />}

    {!isLoading && groups && groups.length == 0 && <NoGroup />}

    <VStack divider={<StackDivider />} align='left' spacing={6}>
      {groups &&
        groups.map(group => 
          <GroupBar
            key={group.id}
            group={group}
            showJoinButton
            showTranscriptLink
            abbreviateOnMobile
          />)
      }
    </VStack>
  </>);
}

function NoGroup() {
  const { data } = trpcNext.users.listRedactedEmailsWithSameName
    .useQuery();

  return <VStack spacing={componentSpacing} align="start">
    {data?.length && 
      <Alert status="warning" mb={componentSpacing}>
        <HStack>
          <AlertIcon />
          <AlertDescription>
            系统发现有与您同名但使用不同电子邮箱的账号。如果您在当前账号下未找到所需功能，{
            }请尝试使用以下可能属于您的邮箱重新登录：
            <UnorderedList mt={paragraphSpacing}>
              {data.map((d, idx) => <ListItem key={idx}><b>{d}</b></ListItem>)}
            </UnorderedList>
          </AlertDescription>
        </HStack>
      </Alert>
    }

    <Text>
      平台提供的功能会根据您的角色的不同而有所差异。如果您未找到所需功能，请与管理员联系。{
      }在继续使用前请确保：</Text>
    <Text>🇨🇳 国内用户请安装腾讯会议（
      <Link isExternal href="https://meeting.tencent.com/download/">
        下载
      </Link>）
    </Text>
    <Text>🌎 海外用户请安装海外版腾讯会议（
      <Link isExternal href="https://voovmeeting.com/download-center.html">
        下载
      </Link>）
    </Text>
  </VStack>;
}
