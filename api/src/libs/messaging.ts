//
// Copyright © 2020 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Created by Jason Leach on 2020-09-09.
//

import { logger } from '@bcgov/common-nodejs-utils';
import fs from 'fs';
import path from 'path';
import DataManager from '../db';
import { Contact } from '../db/model/contact';
import { BodyType, Message, SendReceipt } from '../libs/service';
import shared from './shared';

export const enum MessageType {
  ProvisioningStarted = 0,
  ProvisioningCompleted,
}

export const contactsForProfile = async (profileId: number): Promise<string[]> => {

  try {
    const dm = new DataManager(shared.pgPool);
    const { ContactModel } = dm;
    const contacts: Contact[] = await ContactModel.findForProject(profileId);
    const to = [...new Set(contacts.map(c => c.email))];

    return to;
  } catch (err) {
    const message = `Unable to fetch contacts for profile ${profileId}`;
    logger.error(`${message}, err = ${err.message}`);

    return [];
  }
}

export const sendProvisioningMessage = async (profileId: number, messageType: MessageType): Promise<SendReceipt | undefined> => {

  try {
    const to = await contactsForProfile(profileId);
    let buff;

    if (to.length === 0) {
      return;
    }

    switch (messageType) {
      case MessageType.ProvisioningStarted:
        buff = fs.readFileSync(path.join(__dirname, '../../', 'templates/provisioning-request-received.txt'));
        break;
      case MessageType.ProvisioningCompleted:
        buff = fs.readFileSync(path.join(__dirname, '../../', 'templates/provisioning-request-done.txt'));
        break;
      default:
        logger.info('No message type given');
        return;
    }

    if (!buff) {
      return;
    }


    const message: Message = {
      bodyType: BodyType.Text,
      body: buff.toString('utf8'),
      to,
      from: 'Registry <pathfinder@gov.bc.ca>',
      subject: 'Namespace Provisioning',
    }

    const receipt = await shared.ches.send(message);
    logger.info(`Message (${messageType}) sent with transaction details: ${JSON.stringify(receipt)}`);

    return receipt;
  } catch (err) {
    const message = `Unable to send message for profile ${profileId}`;
    logger.error(`${message}, err = ${err.message}`);

    return;
  }
}
