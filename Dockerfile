FROM node:10.8.0-alpine
LABEL author="Li Xiao-Bo <xiaoboleee@gmail.com>"

RUN yarn global add yrpc && yarn global add grpc

CMD [ "node" ];