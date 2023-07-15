import {
  Box,
  Button,
  Icon,
  Input,
  Stack,
  InputGroup,
  InputLeftAddon,
  InputRightAddon,
  Alert,
  AlertIcon,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Editable,
  EditablePreview,
  EditableInput,
  useEditableControls,
  ButtonGroup,
  IconButton,
  Flex,
  Spacer,
  HStack,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import AppLayout from 'AppLayout'
import { NextPageWithLayout } from '../NextPageWithLayout'
import trpc from "../trpc";
import { CheckIcon, CloseIcon, EditIcon, EmailIcon } from '@chakra-ui/icons';
import { toast } from "react-toastify";
import { useUserContext } from 'UserContext';

// Dedupe code with index.tsx:SetNameModal
const UserProfile: NextPageWithLayout = () => {
  const [user, setUser] = useUserContext();
  const [name, setName] = useState<string>('');
  const [notLoaded, setNotLoaded] = useState(false);

  useEffect(() => {
    setName(user.name || '')
  }, [user]);

  const handleSubmit = async (newName: string) => {
    setNotLoaded(true);

    if (newName) {
      const updatedUser = structuredClone(user);
      updatedUser.name = newName;

      // TODO: Handle error display globally. Redact server-side errors.
      try {
        await trpc.users.update.mutate(updatedUser);
        toast.success("个人信息已保存")
        setUser(updatedUser);
      } catch(e) {
        toast.error((e as Error).message);
      } finally {
        setNotLoaded(false);
      }
    }
  };

  const EditableControls = () => {
    const {
      isEditing,
      getSubmitButtonProps,
      getCancelButtonProps,
      getEditButtonProps,
    } = useEditableControls()

    return isEditing ? (
      <ButtonGroup justifyContent='center' size='sm'>
        <IconButton aria-label='confirm name change button' icon={<CheckIcon />} {...getSubmitButtonProps()} />
        <IconButton aria-label='cancel name change button' icon={<CloseIcon />} {...getCancelButtonProps()} />
      </ButtonGroup>
    ) : (
      <ButtonGroup justifyContent='center' size='sm'>
        <IconButton aria-label='edit name button' size='sm' icon={<EditIcon />} {...getEditButtonProps()} />
      </ButtonGroup>
    )
  }

  const EmailField = () => {
    return (
      <FormControl>
        <HStack spacing='24px'>
          <Box>
            <FormLabel marginTop='10px'>邮箱</FormLabel>
          </Box>
          <Box>
            {user.email}
          </Box>
        </HStack>
      </FormControl>
    )
  }

  const NameField = () => {
    return (
      <FormControl isInvalid={!name}>
        <HStack spacing='24px'>
          <Box>
            <FormLabel marginTop='10px'>中文全名</FormLabel>
          </Box>
          <Box>
            <Editable 
              defaultValue={user.name ? user.name : undefined}
              onSubmit={(newName) => handleSubmit(newName)}
            >
              <HStack>
                <Box>
                  <EditablePreview />
                  <EditableInput 
                    backgroundColor={notLoaded ? 'brandscheme' : 'white'}
                  />
                </Box>
                <Spacer />
                <Box>
                  <EditableControls />
                </Box>
              </HStack>
            </Editable>
          </Box>
        </HStack>
        <FormErrorMessage>用户姓名不能为空</FormErrorMessage>
      </FormControl>
    )
  }

  return (
    <Box paddingTop={'80px'}>
      <Stack spacing={4}>
        <EmailField />
        <NameField />
      </Stack>
    </Box>
  )
}

UserProfile.getLayout = (page) => <AppLayout>{page}</AppLayout>;

export default UserProfile;
