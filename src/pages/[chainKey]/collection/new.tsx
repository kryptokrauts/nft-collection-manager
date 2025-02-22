import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { withUAL } from 'ual-reactjs-renderer';

import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { CircleNotch, CaretDown } from '@phosphor-icons/react';
import { Disclosure } from '@headlessui/react';

import { createCollectionService } from '@services/collection/createCollectionService';

import { Input } from '@components/Input';
import { Textarea } from '@components/Textarea';
import { Modal } from '@components/Modal';
import { Header } from '@components/Header';
import { Select } from '@components/Select';

import { countriesList } from '@utils/countriesList';

import { appName, ipfsEndpoint } from '@configs/globalsConfig';
import { getCollectionService } from '@services/collection/getCollectionService';

const schema = yup.object().shape({
  imageIpfsHash: yup
    .mixed()
    .test('imageIpfsHash', 'Image IPFS hash is required', (value) => {
      return value.startsWith('Qm') || value.startsWith('bafy');
    }),
  collectionName: yup.string().matches(/^[a-z1-5.]+$/, {
    message: 'Only lowercase letters (a-z) and numbers 1-5 are allowed.',
    excludeEmptyString: false,
  }),
  displayName: yup.string().required().label('Display name'),
  // website: yup.string().required().url().label('Website'),
  marketFee: yup
    .number()
    .typeError('Must be between 0% and 15%. Only numbers.')
    .min(0, 'Must be between 0% and 15%.')
    .max(15, 'Must be between 0% and 15%.')
    .label('Market fee'),
  description: yup.string(),
});

function CreateNewCollection({ ual }) {
  const router = useRouter();
  const modalRef = useRef(null);

  const [previewImageSrc, setPreviewImageSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [collectionNameError, setCollectionNameError] = useState('');
  const [modal, setModal] = useState({
    title: '',
    message: '',
    details: '',
    isError: false,
  });

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
    setValue,
  } = useForm({
    resolver: yupResolver(schema),
  });

  const imageIpfsHash = watch('imageIpfsHash');
  const collectionName = watch('collectionName');

  useEffect(() => {
    if (
      imageIpfsHash &&
      (imageIpfsHash.startsWith('Qm') || imageIpfsHash.startsWith('bafy'))
    ) {
      setPreviewImageSrc(`${ipfsEndpoint}/${imageIpfsHash}`);
    } else {
      setPreviewImageSrc(null);
    }
  }, [imageIpfsHash]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSaved(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isSaved]);

  useEffect(() => {
    if (collectionName && ual.activeUser.accountName) {
      if (!isValidCollectionName(collectionName, ual.activeUser?.accountName)) {
        setCollectionNameError(
          'Must be up to 12 characters (a-z, 1-5) with no spaces. Less than 12 characters are only allowed if you control the XPR account with the same name.'
        );
        setIsLoading(false);
        return;
      } else {
        setCollectionNameError('');
      }
    }
  }, [collectionName, ual]);

  function isValidCollectionName(collectionName, userAccount) {
    if (collectionName.length > 12) {
      return false;
    }

    if (
      (collectionName.length <= 12 &&
        (collectionName === userAccount ||
          (collectionName.endsWith(`.${userAccount}`) &&
            !collectionName.startsWith('.')))) ||
      (collectionName.length === 12 && !collectionName.includes('.'))
    ) {
      return true;
    }

    return false;
  }

  async function generateCollectionName() {
    const validNumbers = '12345';
    let result = '';
    for (let i = 0; i < 12; i++) {
      const randomIndex = Math.floor(Math.random() * validNumbers.length);
      result += validNumbers.charAt(randomIndex);
    }
    try {
      await getCollectionService(router.query.chainKey as string, {
        collectionName: result,
      });
      // expecting an error if the collection does not exist
      // calling the function again if the ID is already used
      generateCollectionName();
    } catch (e) {
      // we have a unique collection id
      setValue('collectionName', result);
    }
  }

  async function onSubmit({
    // image,
    imageIpfsHash,
    collectionName,
    displayName,
    website,
    marketFee,
    description,
    telegram,
    twitter,
    instagram,
    discord,
    youtube,
    snipverse,
    medium,
  }) {
    setIsLoading(true);

    try {
      const socialLinks = [
        { name: 'website', link: website },
        { name: 'twitter', link: twitter },
        { name: 'telegram', link: telegram },
        { name: 'instagram', link: instagram },
        { name: 'youtube', link: youtube },
        { name: 'discord', link: discord },
        { name: 'snipverse', link: snipverse },
        { name: 'medium', link: medium },
      ];

      if (collectionNameError) {
        setIsLoading(false);
        return;
      }

      const socials = socialLinks
        .map((link) => {
          const trimmedLink = link.link
            ? link.link.trim().replace(/\/+$/, '')
            : '';
          return `${link.name}:${trimmedLink}`;
        })
        .join('\n');

      await createCollectionService({
        activeUser: ual.activeUser,
        author: ual.activeUser.accountName,
        collectionName,
        notify: true,
        authorizedAccounts: [ual.activeUser.accountName],
        notifyAccounts: [],
        marketFee: marketFee / 100.0,
        data: [
          {
            key: 'name',
            value: ['string', displayName],
          },
          {
            key: 'description',
            value: ['string', description],
          },
          {
            key: 'img',
            value: ['string', imageIpfsHash],
          },
          {
            key: 'url',
            value: ['string', `${socials}\n`],
          },
        ],
      });
      setIsSaved(true);

      router.push(`/${router.query.chainKey}/collection/${collectionName}`);
    } catch (e) {
      modalRef.current?.openModal();
      const jsonError = JSON.parse(JSON.stringify(e));
      const details = JSON.stringify(e, undefined, 2);
      const message =
        jsonError?.cause?.json?.error?.details[0]?.message ??
        'Unable to create collection';

      setModal({
        title: 'Error',
        message,
        details,
        isError: true,
      });
    }

    setIsLoading(false);
  }

  function handleLogin() {
    ual.showModal();
  }

  if (!ual?.activeUser) {
    return (
      <div className="mx-auto my-14 text-center">
        <h2 className="headline-2">Connect your wallet</h2>
        <p className="body-1 mt-2 mb-6">
          You need to connect your wallet to create a new collection
        </p>
        <button type="button" className="btn" onClick={handleLogin}>
          Connect Wallet
        </button>
      </div>
    );
  }

  function handlePrependHttps(event) {
    const { value } = event.target;

    if (
      !value.startsWith('https://') &&
      event.nativeEvent.inputType !== 'deleteContentBackward'
    ) {
      return 'https://' + value;
    }

    return value;
  }

  return (
    <>
      <Head>
        <title>{`New Collection - ${appName}`}</title>
      </Head>

      <Header.Root
        border
        breadcrumb={[
          ['My Collections', `/${router.query.chainKey}`],
          ['New Collection'],
        ]}
      >
        <Header.Content title="New Collection" />
      </Header.Root>

      <Modal ref={modalRef} title={modal.title}>
        <p className="body-2 mt-2">{modal.message}</p>
        {!modal.isError ? (
          <span className="flex gap-2 items-center py-4 body-2 font-bold text-white">
            <CircleNotch size={24} weight="bold" className="animate-spin" />
            Redirecting...
          </span>
        ) : (
          <Disclosure>
            <Disclosure.Button className="btn btn-small mt-4">
              Details
            </Disclosure.Button>
            <Disclosure.Panel>
              <pre className="overflow-auto p-4 rounded-lg bg-zinc-700 max-h-96 mt-4">
                {modal.details}
              </pre>
            </Disclosure.Panel>
          </Disclosure>
        )}
      </Modal>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div
          className="container
            py-8 md:py-12 lg:py-16
            grid grid-cols-4 gap-8
            md:grid-cols-6 lg:grid-cols-12"
        >
          <div className="col-span-4 md:col-span-3 lg:col-span-5">
            <label
              className={`block aspect-square bg-zinc-800 rounded-xl p-md border ${
                errors.image?.message ? 'border-red-600' : 'border-zinc-700'
              }`}
            >
              {previewImageSrc ? (
                <div className="w-full h-full relative">
                  <Image
                    src={previewImageSrc}
                    fill
                    className="object-contain"
                    alt=""
                  />
                </div>
              ) : (
                <div
                  className={`w-full h-full flex flex-col justify-center items-center gap-2 ${
                    errors.imageIpfsHash?.message
                      ? 'text-red-600'
                      : 'text-center'
                  }`}
                >
                  <p className="title-1">Collection Image Preview</p>
                  <p className="body-3">
                    Will be shown if you provide a valid IPFS hash in the form.
                    <br />
                    Transparent backgrounds are recommended.
                  </p>
                </div>
              )}
            </label>
          </div>

          <div className="col-span-4 md:col-span-3 lg:col-start-7 lg:col-span-6 flex flex-col gap-8">
            <Input
              {...register('collectionName')}
              error={errors.collectionName?.message || collectionNameError}
              label="Collection ID"
              hint="Unique identifier of the collection. Must be up to 12 characters (a-z, 1-5) with no spaces.
                Less than 12 characters are only allowed if you control the XPR account with the same name.
                For simplicity you can simply generate a random ID."
              type="text"
              maxLength={12}
            />
            <button
              type="button"
              className={`btn w-fit whitespace-nowrap`}
              onClick={generateCollectionName}
            >
              Random ID
            </button>
            <Input
              {...register('displayName')}
              error={errors.displayName?.message}
              type="text"
              label="Name"
            />
            <Input
              {...register('imageIpfsHash')}
              error={errors.imageIpfsHash?.message}
              type="text"
              label="Image (IPFS Hash)"
            />
            <Controller
              control={control}
              name="website"
              defaultValue=""
              render={({ field }) => (
                <Input
                  error={errors.website?.message}
                  label="Website"
                  value={field.value}
                  onChange={(event) => {
                    const value = handlePrependHttps(event);
                    field.onChange(value);
                  }}
                  type="text"
                />
              )}
            />
            <Input
              {...register('marketFee')}
              error={errors.marketFee?.message}
              label="Market fee"
              hint="Must be between 0% and 15%. Only numbers."
              type="number"
              min="0"
              max="15"
              step="0.1"
            />
            <Textarea
              {...register('description')}
              error={errors.description?.message}
              label="Description"
            />
            <div className="flex flex-col gap-4 my-4">
              <Disclosure>
                {({ open }) => (
                  <>
                    <Disclosure.Button className="flex flex-row justify-between items-center py-4 border-y border-zinc-700">
                      <div className="flex flex-row gap-2 items-baseline">
                        <span className="title-1">Social Media</span>
                        <span className="body-1">(optional)</span>
                      </div>
                      <CaretDown
                        size={32}
                        className={`${
                          open ? 'rotate-180 transform' : ''
                        } h-5 w-5`}
                      />
                    </Disclosure.Button>
                    <Disclosure.Panel className="flex flex-col gap-8">
                      <Controller
                        control={control}
                        name="twitter"
                        defaultValue=""
                        render={({ field }) => (
                          <Input
                            label="Twitter"
                            value={field.value}
                            onChange={(event) => {
                              const value = handlePrependHttps(event);
                              field.onChange(value);
                            }}
                            type="text"
                            placeholder="https://twitter.com/@handle"
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="telegram"
                        defaultValue=""
                        render={({ field }) => (
                          <Input
                            label="Telegram"
                            value={field.value}
                            onChange={(event) => {
                              const value = handlePrependHttps(event);
                              field.onChange(value);
                            }}
                            type="text"
                            placeholder="https://t.me/username"
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="discord"
                        defaultValue=""
                        render={({ field }) => (
                          <Input
                            label="Discord"
                            value={field.value}
                            onChange={(event) => {
                              const value = handlePrependHttps(event);
                              field.onChange(value);
                            }}
                            type="text"
                            placeholder="https://discord.gg/invite/channel"
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="snipverse"
                        defaultValue=""
                        render={({ field }) => (
                          <Input
                            label="Snipverse"
                            value={field.value}
                            onChange={(event) => {
                              const value = handlePrependHttps(event);
                              field.onChange(value);
                            }}
                            type="text"
                            placeholder="https://snipverse.com/username"
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="instagram"
                        defaultValue=""
                        render={({ field }) => (
                          <Input
                            label="Instagram"
                            value={field.value}
                            onChange={(event) => {
                              const value = handlePrependHttps(event);
                              field.onChange(value);
                            }}
                            type="text"
                            placeholder="https://www.instagram.com/username"
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="youtube"
                        defaultValue=""
                        render={({ field }) => (
                          <Input
                            label="Youtube"
                            value={field.value}
                            onChange={(event) => {
                              const value = handlePrependHttps(event);
                              field.onChange(value);
                            }}
                            type="text"
                            placeholder="https://youtube.com/channel/channelurl"
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="facebook"
                        defaultValue=""
                        render={({ field }) => (
                          <Input
                            label="Facebook"
                            value={field.value}
                            onChange={(event) => {
                              const value = handlePrependHttps(event);
                              field.onChange(value);
                            }}
                            type="text"
                            placeholder="https://facebook.com/pageurl"
                          />
                        )}
                      />
                      <Controller
                        control={control}
                        name="medium"
                        defaultValue=""
                        render={({ field }) => (
                          <Input
                            label="Medium"
                            value={field.value}
                            onChange={(event) => {
                              const value = handlePrependHttps(event);
                              field.onChange(value);
                            }}
                            type="text"
                            placeholder="https://medium.com/@username"
                          />
                        )}
                      />
                    </Disclosure.Panel>
                  </>
                )}
              </Disclosure>
              {/* <Disclosure>
                {({ open }) => (
                  <>
                    <Disclosure.Button className="flex flex-row justify-between items-center pb-4 border-b border-zinc-700">
                      <div className="flex flex-row gap-2 items-baseline">
                        <span className="title-1">Company Details</span>
                        <span className="body-1">(optional)</span>
                      </div>
                      <CaretDown
                        size={32}
                        className={`${
                          open ? 'rotate-180 transform' : ''
                        } h-5 w-5`}
                      />
                    </Disclosure.Button>
                    <Disclosure.Panel className="flex flex-col gap-8">
                      <Input
                        {...register('company')}
                        label="Company"
                        type="text"
                        placeholder="e.g: Facings"
                      />
                      <Input
                        {...register('registrationNumber')}
                        label="Registration number"
                        type="number"
                        placeholder="e.g: 123456"
                      />
                      <Input
                        {...register('name')}
                        label="Name of Owner / Managing Director"
                        type="text"
                        placeholder="e.g: John Doe"
                      />
                      <Controller
                        control={control}
                        name="country"
                        render={({ field }) => (
                          <Select
                            label="Country"
                            onChange={field.onChange}
                            selectedValue={field.value}
                            options={countriesList}
                            placeholder="Select a country"
                          />
                        )}
                      />
                      <Input
                        {...register('address')}
                        label="Address"
                        type="text"
                        placeholder="e.g: Gluthstrasse 8"
                      />
                      <Input
                        {...register('city')}
                        label="City"
                        type="text"
                        placeholder="e.g: Munich"
                      />
                      <Input
                        {...register('zipCode')}
                        label="Zip code / Postal Code"
                        type="number"
                        placeholder="e.g: 80803"
                      />
                    </Disclosure.Panel>
                  </>
                )}
              </Disclosure> */}
            </div>
            {isLoading ? (
              <span className="flex gap-2 items-center p-4 body-2 font-bold text-white">
                <CircleNotch size={24} weight="bold" className="animate-spin" />
                Loading...
              </span>
            ) : (
              <button
                type="submit"
                className={`btn w-fit whitespace-nowrap ${
                  isSaved && 'animate-pulse bg-emerald-600'
                }`}
              >
                {isSaved ? 'Saved' : 'Create Collection'}
              </button>
            )}
          </div>
        </div>
      </form>
    </>
  );
}

export default withUAL(CreateNewCollection);
